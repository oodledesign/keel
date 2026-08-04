import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Anthropic from '@anthropic-ai/sdk';

import { callAI, withMeteredAI } from '~/lib/ai/router';
import { extractJsonObject } from '~/lib/ai/extract-json-object';

import type { ScorerInput, ScorerOutput } from './types';
import { CITATION_SAMPLE_RUNS } from './types';

/** Comprehensive rec lists (18–28 items) routinely exceed 6k tokens. */
const SCORER_MAX_TOKENS = 16_384;
const SCORER_CONTINUE_ATTEMPTS = 3;

type ClaudeCallResult = {
  text: string;
  stopReason: string | null;
};

function buildScorerPrompt(input: ScorerInput): string {
  const { domain, robotsResult, llmsTxt, sitemap, pages, aiCitations } = input;
  const host = domain.replace(/^www\./, '');

  const homepage =
    pages.find((page) => {
      try {
        const pathname = new URL(page.url).pathname;
        return pathname === '/' || pathname === '';
      } catch {
        return page.url.includes(host);
      }
    }) ?? pages[0];

  const allJsonLdTypes = [
    ...new Set(pages.flatMap((page) => page.jsonLd.map((block) => block.type))),
  ];
  const pagesWithFaq = pages
    .filter((page) => page.faqPatternPresent)
    .map((page) => page.url);
  const pagesWithByline = pages
    .filter((page) => page.bylinePresent)
    .map((page) => page.url);
  const jsRenderedPages = pages
    .filter((page) => page.isJsRendered)
    .map((page) => page.url);

  return `
Produce a complete AI search audit for ${host}. Every recommendation MUST reference
specific evidence below — specific pages, specific missing properties, specific content.
Do not give generic advice not grounded in the data.

---
DOMAIN: ${host}
PAGES CRAWLED: ${pages.length}
${pages
  .map(
    (page) =>
      `  ${page.url} (HTTP ${page.statusCode}, ${page.wordCount} words, fetch=${page.fetchProfile ?? 'rankly'}${page.botBlockedInitially ? ', bot-blocked initially' : ''}, title: "${page.title}")`,
  )
  .join('\n')}

ROBOTS.TXT:
- Present: ${robotsResult.present}
- Wildcard block (Disallow: /): ${robotsResult.wildcardBlocked}
- AI bots BLOCKED: ${robotsResult.blocked.join(', ') || 'none'}
- AI bots ALLOWED: ${robotsResult.allowed.join(', ')}

LLMS.TXT: ${llmsTxt.present ? `Present (${llmsTxt.wordCount ?? 0} words)` : 'NOT PRESENT'}

SITEMAP: ${sitemap.present ? `Present (${sitemap.urlCount} URLs, last updated: ${sitemap.lastmod ?? 'unknown'})` : 'NOT PRESENT'}

JSON-LD SCHEMA TYPES FOUND ACROSS SITE:
${allJsonLdTypes.length ? allJsonLdTypes.join(', ') : 'NONE FOUND'}

HOMEPAGE JSON-LD DETAIL:
${JSON.stringify(homepage?.jsonLd ?? [], null, 2)}

PAGES WITH FAQ PATTERN: ${pagesWithFaq.join(', ') || 'none'}
PAGES WITH BYLINE/AUTHOR: ${pagesWithByline.join(', ') || 'none'}
JS-RENDERED PAGES (content invisible to AI crawlers): ${jsRenderedPages.join(', ') || 'none'}

TITLE TAG AUDIT:
${pages.map((page) => `  ${page.url}: "${page.title}"`).join('\n')}

META DESCRIPTION AUDIT:
${pages
  .map(
    (page) =>
      `  ${page.url}: ${page.metaDesc ? `"${page.metaDesc.slice(0, 80)}…"` : 'MISSING'}`,
  )
  .join('\n')}

OG TAG AUDIT:
${pages
  .map(
    (page) =>
      `  ${page.url}: og:image=${page.ogImage ? 'present' : 'MISSING'}, og:title=${page.ogTitle ? 'present' : 'MISSING'}`,
  )
  .join('\n')}

HEADING STRUCTURE (homepage):
H1s: ${homepage?.h1s.join(' | ') || 'none'}
H2s: ${homepage?.h2s.slice(0, 10).join(' | ') || 'none'}

CONTENT SIGNALS:
${pages
  .map(
    (page) =>
      `  ${page.url}: tables=${page.tableCount}, hasTldr=${page.hasTldr}, lastUpdatedVisible=${page.lastUpdatedVisible}`,
  )
  .join('\n')}

AI CITATIONS BY PLATFORM (DataForSEO live checks, ${CITATION_SAMPLE_RUNS} samples per prompt):
${aiCitations.platforms
  .map(
    (platform) =>
      `${platform.label} (${platform.promptLayer === 'contextual' ? 'buyer context' : 'category benchmark'}):
${platform.citations
  .map(
    (citation) =>
      `    "${citation.query}": presence=${citation.presenceRate ?? (citation.domainCited ? 100 : 0)}% (${citation.sampleCount ?? 1} runs), triggered=${citation.triggered}${citation.citedUrls.length ? `, urls=${citation.citedUrls.slice(0, 3).join('; ')}` : ''}`,
  )
  .join('\n')}`,
  )
  .join('\n\n')}
Competing brands cited instead: ${aiCitations.competingBrands.join(', ') || 'none detected'}

---
Score each dimension 0–100 based strictly on the evidence above.
Scoring guidance:
- 80–100: Strong — most signals present, minor gaps
- 60–79: Moderate — key signals present but important gaps
- 40–59: Weak — significant gaps affecting AI discoverability
- 0–39: Critical — fundamental signals missing

Then produce a prioritised recommendation list. Rules:
- Each recommendation must name a specific page URL from the crawl as example_urls
- "outcome" = what LLMs will do differently as a result (one sentence)
- "why" = the technical reason this helps AI parsing (one sentence)
- "magnitude" = one of: "Critical for...", "Significant for...", "High for...", "Moderate for..."
- is_quick_win = true if implementable in under 30 minutes (schema addition, title fix, meta update)
- Include 5–8 HIGH priority, 8–12 MEDIUM, 5–8 LOW
- HIGH = directly blocks or significantly impairs AI citation
- MEDIUM = improves citation reliability and topical authority
- LOW = incremental improvements, future-proofing
- Keep string fields concise (1–2 sentences) so the full JSON fits

Return this exact JSON shape:

{
  "score_entity": 74,
  "score_content": 67,
  "score_eeat": 74,
  "score_tech": 40,
  "overall_score": 64,
  "executive_summary": "2–3 sentence summary suitable for a client report",
  "recommendations": [
    {
      "dimension": "entity",
      "priority": "high",
      "is_quick_win": false,
      "title": "Implement Organization Schema with knowsAbout properties",
      "description": "Add JSON-LD to the homepage defining the organisation.",
      "outcome": "LLMs will associate the brand with its specialist areas.",
      "why": "Explicit schema triples remove the need for LLMs to infer authority from prose.",
      "magnitude": "Significant for brand-authority queries and industry-specific discovery.",
      "example_urls": ["https://example.com"]
    }
  ]
}
`;
}

async function callClaudeMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
): Promise<ClaudeCallResult> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { FEATURE_CONFIG } = await import('~/lib/ai/router');
  const model = FEATURE_CONFIG.ai_audit_score.model;

  const response = await anthropic.messages.create({
    model,
    max_tokens: SCORER_MAX_TOKENS,
    system,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  return {
    text,
    stopReason: response.stop_reason ?? null,
  };
}

function parseScorerJson(text: string): ScorerOutput {
  const cleaned = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid JSON from scorer';
    throw new Error(`Audit recommendation JSON was incomplete (${message})`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Audit scorer returned an empty response');
  }

  const value = parsed as Partial<ScorerOutput>;
  if (!Array.isArray(value.recommendations)) {
    throw new Error('Audit scorer JSON missing recommendations');
  }

  return value as ScorerOutput;
}

function looksTruncated(text: string, stopReason: string | null): boolean {
  if (stopReason === 'max_tokens') return true;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return false;
  if (!trimmed.endsWith('}')) return true;
  try {
    JSON.parse(extractJsonObject(trimmed));
    return false;
  } catch {
    return true;
  }
}

async function generateScorerJson(prompt: string): Promise<ScorerOutput> {
  const system = `You are an expert in AI search optimisation (AEO/GEO). You analyse website evidence and produce scored audit reports with specific, actionable recommendations.
Every recommendation must reference actual evidence from the domain — specific pages, specific missing schema types, specific title tag content. Never give generic advice.
Output only valid JSON. No markdown fences. No preamble. Start with {`;

  let assembled = '';
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: prompt },
  ];

  for (let attempt = 0; attempt < SCORER_CONTINUE_ATTEMPTS; attempt += 1) {
    const result = await callClaudeMessages(messages, system);
    const chunk = result.text.trim();
    if (!chunk) {
      throw new Error('Audit scorer returned an empty response');
    }

    assembled = assembled ? `${assembled}${chunk}` : chunk;

    try {
      return parseScorerJson(assembled);
    } catch (error) {
      const truncated = looksTruncated(assembled, result.stopReason);
      if (!truncated || attempt === SCORER_CONTINUE_ATTEMPTS - 1) {
        throw error;
      }

      messages.push({ role: 'assistant', content: chunk });
      messages.push({
        role: 'user',
        content:
          'Continue the JSON exactly where you left off. Output only the missing continuation characters — no preamble, no restarting the object.',
      });
    }
  }

  throw new Error('Audit recommendation generation was cut off. Please retry.');
}

export async function scoreAndRecommend(
  input: ScorerInput,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<ScorerOutput> {
  const prompt = buildScorerPrompt(input);

  return withMeteredAI({
    feature: 'ai_audit_score',
    accountId: meter.accountId,
    supabase: meter.supabase,
    run: async () => {
      try {
        return { result: await generateScorerJson(prompt) };
      } catch (firstError) {
        console.warn(
          '[rankly] ai-audit scorer first pass failed; retrying',
          firstError instanceof Error ? firstError.message : firstError,
        );
        try {
          return {
            result: await generateScorerJson(
              `${prompt}

IMPORTANT: Output compact valid JSON only. Keep recommendation strings to one sentence each.`,
            ),
          };
        } catch (secondError) {
          const detail =
            secondError instanceof Error
              ? secondError.message
              : 'Recommendation generation failed';
          throw new Error(
            `Could not finish generating recommendations (${detail}). Crawl and citation data were saved — retry the audit to resume scoring.`,
          );
        }
      }
    },
  });
}

export async function generateFixSnippet(
  input: {
    title: string;
    description: string;
    exampleUrl: string;
    dimension: string;
  },
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<string> {
  return callAI({
    feature: 'ai_audit_suggest',
    systemPrompt:
      'You produce specific, copy-paste-ready fixes for AI search optimisation issues. Output the fix only — no explanation, no preamble.',
    userPrompt: `Produce a specific, copy-paste-ready fix for this recommendation:

Title: ${input.title}
Description: ${input.description}
Example page: ${input.exampleUrl}
Dimension: ${input.dimension}

If the fix is JSON-LD schema, output a complete <script type="application/ld+json"> block.
If it's a title tag fix, output the corrected <title> tag.
If it's a content addition, output the HTML to add.
If it's a robots.txt fix, output the specific lines to add/remove.
Keep it minimal and precise.`,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
}
