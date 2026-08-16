import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Anthropic from '@anthropic-ai/sdk';
import { load } from 'cheerio';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import {
  type ExtractedRecipeDraft,
  emptyRecipeDraft,
  isInstagramRecipeUrl,
  isPrivateOrLocalUrl,
  mapSchemaOrgRecipe,
  normalizeExtractedRecipeDraft,
  normalizeUrl,
} from '~/lib/ai/recipe-extract-utils';
import {
  FEATURE_CONFIG,
  HAIKU_MODEL,
  callAI,
  withMeteredAI,
} from '~/lib/ai/router';
import { extractPageJsonLd } from '~/lib/crawl/json-ld';

import type {
  RecipeExtractMethod,
  RecipeExtractSource,
} from './recipe-extract-types';

export type { ExtractedRecipeDraft } from '~/lib/ai/recipe-extract-utils';
export type {
  RecipeExtractMethod,
  RecipeExtractSource,
} from './recipe-extract-types';
export {
  ExtractedRecipeDraftSchema,
  isInstagramRecipeUrl,
  isoDurationToMinutes,
  mapSchemaOrgRecipe,
} from '~/lib/ai/recipe-extract-utils';

const RECIPE_EXTRACT_FEATURE = 'recipe_extract' as const;

const MAX_PAGE_CHARS = 14_000;
const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const RECIPE_FETCH_UA = 'OzerRecipeBot/1.0 (+https://ozer.so; recipe-extract)';

export type RecipeExtractResult = {
  recipe: ExtractedRecipeDraft;
  method: RecipeExtractMethod;
};

const EXTRACTION_SYSTEM_PROMPT = `You extract cookable recipes into structured JSON for a family meal planner.

Return ONLY valid minified JSON (no markdown fences, no commentary) matching:
{"name":"string","description":"string or null","ingredients":["200g pasta","2 tbsp olive oil"],"instructions":"string or null","tags":["italian","one-pan"],"meal_type":"dinner","prep_minutes":10,"cook_minutes":25,"servings":4}

Rules:
- Use British English spelling in names, descriptions, instructions, and tags.
- ingredients: plain text lines with quantities where known (e.g. "2 tbsp olive oil"). Do not invent amounts.
- instructions: numbered or paragraph method as plain text. Preserve step order.
- meal_type must be one of: breakfast, lunch, dinner, snack, any.
- tags: short cuisine/style labels (max 8). Omit diet claims unless explicit in the source.
- prep_minutes / cook_minutes / servings: integers or null when unknown.
- Do not invent a recipe if the source is not a recipe — only extract what is present.
- Never wrap the JSON in markdown.`;

function parseLlmRecipeJson(text: string): ExtractedRecipeDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text || '{}'));
  } catch {
    throw new Error('Could not parse recipe extraction response');
  }
  const draft = normalizeExtractedRecipeDraft(parsed);
  if (
    draft.name === emptyRecipeDraft().name &&
    draft.ingredients.length === 0 &&
    !draft.instructions
  ) {
    throw new Error('No recipe content found in the source');
  }
  return draft;
}

export async function extractRecipeFromText(
  payload: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<RecipeExtractResult> {
  const text = await callAI({
    feature: RECIPE_EXTRACT_FEATURE,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userPrompt: `Extract the recipe from this text:\n\n---\n${payload.slice(0, MAX_PAGE_CHARS)}\n---`,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });

  return {
    recipe: parseLlmRecipeJson(text),
    method: 'llm_text',
  };
}

function parseImagePayload(payload: string): {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
} {
  const trimmed = payload.trim();
  const dataUrl = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i.exec(
    trimmed,
  );
  if (dataUrl?.[1] && dataUrl[2]) {
    return {
      mediaType: dataUrl[1].toLowerCase() as
        | 'image/jpeg'
        | 'image/png'
        | 'image/gif'
        | 'image/webp',
      data: dataUrl[2].replace(/\s/g, ''),
    };
  }

  const raw = trimmed.includes(',') ? trimmed.split(',')[1]! : trimmed;
  return {
    mediaType: 'image/jpeg',
    data: raw.replace(/\s/g, ''),
  };
}

export async function extractRecipeFromImage(
  payload: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<RecipeExtractResult> {
  const { mediaType, data } = parseImagePayload(payload);
  if (!data || data.length < 32) {
    throw new Error('Image payload is empty or invalid');
  }
  // Anthropic's vision limit is 5 MB decoded. base64 ≈ 4/3 raw bytes.
  // Cap at ~4 MB decoded (≈ 5.5 MB base64) to stay safely under the limit.
  const MAX_IMAGE_BASE64_CHARS = 5_500_000;
  if (data.length > MAX_IMAGE_BASE64_CHARS) {
    throw new Error(
      'Image is too large to process — please use a smaller photo',
    );
  }

  const config = FEATURE_CONFIG[RECIPE_EXTRACT_FEATURE];
  const text = await withMeteredAI({
    feature: RECIPE_EXTRACT_FEATURE,
    accountId: meter.accountId,
    supabase: meter.supabase,
    run: async () => {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const response = await anthropic.messages.create({
        model: config.model || HAIKU_MODEL,
        max_tokens: config.maxOutputTokens,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data,
                },
              },
              {
                type: 'text',
                text: 'Extract the recipe shown in this image as JSON.',
              },
            ],
          },
        ],
      });

      const block = response.content.find((item) => item.type === 'text');
      return {
        result: block && block.type === 'text' ? block.text : '',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  });

  return {
    recipe: parseLlmRecipeJson(text),
    method: 'llm_image',
  };
}

async function fetchInstagramCaption(url: string): Promise<string | null> {
  const endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': RECIPE_FETCH_UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      title?: unknown;
      author_name?: unknown;
    };
    const title = typeof json.title === 'string' ? json.title.trim() : '';
    const author =
      typeof json.author_name === 'string' ? json.author_name.trim() : '';
    if (!title) return null;
    return author ? `${title}\n\n— ${author}` : title;
  } catch {
    return null;
  }
}

async function fetchPageHtml(url: string): Promise<string> {
  const fetchHeaders = {
    'User-Agent': RECIPE_FETCH_UA,
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.8',
  };

  // Disable automatic redirect following so we can SSRF-check each hop.
  let response = await fetch(url, {
    headers: fetchHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  // Allow exactly one redirect hop; re-validate the destination before following.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location)
      throw new Error('Could not fetch URL (redirect with no location)');
    const redirectUrl = new URL(location, url).href;
    if (isPrivateOrLocalUrl(redirectUrl)) {
      throw new Error('That URL cannot be fetched');
    }
    response = await fetch(redirectUrl, {
      headers: fetchHeaders,
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }

  if (!response.ok) {
    throw new Error(`Could not fetch URL (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_HTML_BYTES) {
    throw new Error('Page is too large to extract');
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

function htmlToReadableText(html: string): string {
  const $ = load(html);
  $(
    'script, style, noscript, iframe, svg, nav, footer, header, .cookie-banner, #cookie-consent',
  ).remove();

  const title = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const body = $('main, article, [itemtype*="Recipe"], [role="main"], body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return [title, metaDesc, body]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_PAGE_CHARS);
}

function findSchemaOrgRecipe(html: string): ExtractedRecipeDraft | null {
  const $ = load(html);
  const { schemaObjects } = extractPageJsonLd($);

  for (const item of schemaObjects) {
    const mapped = mapSchemaOrgRecipe(item);
    if (mapped && (mapped.ingredients.length > 0 || mapped.instructions)) {
      return mapped;
    }
  }

  for (const item of schemaObjects) {
    const mapped = mapSchemaOrgRecipe(item);
    if (mapped) return mapped;
  }

  return null;
}

export async function extractRecipeFromUrl(
  payload: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<RecipeExtractResult> {
  const url = normalizeUrl(payload.trim());
  if (isPrivateOrLocalUrl(url)) {
    throw new Error('That URL cannot be fetched');
  }

  if (isInstagramRecipeUrl(url)) {
    const caption = await fetchInstagramCaption(url);
    if (!caption) {
      throw new Error(
        'Could not read this Instagram caption. Paste the recipe text instead, or try a link where the method is written in the caption.',
      );
    }
    const extracted = await extractRecipeFromText(caption, meter);
    return { recipe: extracted.recipe, method: 'instagram_caption' };
  }

  const html = await fetchPageHtml(url);
  const fromSchema = findSchemaOrgRecipe(html);
  if (fromSchema) {
    return { recipe: fromSchema, method: 'schema_org' };
  }

  const readable = htmlToReadableText(html);
  if (!readable.trim()) {
    throw new Error('No readable recipe content found on that page');
  }

  const extracted = await extractRecipeFromText(readable, meter);
  return { recipe: extracted.recipe, method: 'llm_text' };
}

export async function extractRecipe(
  source: RecipeExtractSource,
  payload: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<RecipeExtractResult> {
  switch (source) {
    case 'text':
      return extractRecipeFromText(payload, meter);
    case 'image':
      return extractRecipeFromImage(payload, meter);
    case 'url':
      return extractRecipeFromUrl(payload, meter);
    default: {
      const _exhaustive: never = source;
      throw new Error(`Unsupported source: ${_exhaustive}`);
    }
  }
}
