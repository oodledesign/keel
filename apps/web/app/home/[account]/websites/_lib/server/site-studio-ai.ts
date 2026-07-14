import 'server-only';

import type { z } from 'zod';

import {
  callAI,
  invokeAIProvider,
  type OzerAIFeatureKey,
} from '~/lib/ai/router';
import type { WebsiteSitemapPage } from '~/lib/websites/planning-types';
import { briefContextText } from '~/lib/websites/brief-types';
import type { WebsiteBrief } from '~/lib/websites/brief-types';
import { extractJson } from '~/lib/websites/extract-json';
import { WEBSITE_SECTION_LIBRARY } from '~/lib/websites/section-library';

export { extractJson } from '~/lib/websites/extract-json';

type SupabaseLike = Parameters<typeof callAI>[0]['supabase'];

/**
 * Call a feature, parse JSON, validate with Zod. On validation/parse failure,
 * retry once with a repair system prompt — free (invokeAIProvider only).
 */
export async function callAIValidatedJson<TSchema extends z.ZodType>(params: {
  feature: OzerAIFeatureKey;
  systemPrompt: string;
  userPrompt: string;
  accountId: string;
  supabase: SupabaseLike;
  schema: TSchema;
}): Promise<z.infer<TSchema>> {
  const text = await callAI({
    feature: params.feature,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    accountId: params.accountId,
    supabase: params.supabase,
  });

  try {
    return parseValidated(text, params.schema);
  } catch (firstError) {
    const repairPrompt = [
      'Your previous response failed validation. Return ONLY corrected JSON.',
      'No markdown fences, no commentary.',
      `Validation error: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
      '',
      'Original task:',
      params.userPrompt.slice(0, 6000),
      '',
      'Previous (invalid) response:',
      text.slice(0, 6000),
    ].join('\n');

    const repaired = await invokeAIProvider({
      feature: params.feature,
      systemPrompt:
        'Output only valid JSON matching the required schema. No markdown. No preamble.',
      userPrompt: repairPrompt,
    });

    try {
      return parseValidated(repaired.text, params.schema);
    } catch (secondError) {
      throw new Error(
        secondError instanceof Error
          ? secondError.message
          : 'AI response failed validation after repair',
      );
    }
  }
}

function parseValidated<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  let raw: unknown;
  try {
    raw = extractJson<unknown>(text);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to parse AI JSON response',
    );
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `AI JSON failed schema: ${result.error.issues
        .slice(0, 4)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

export function briefContextBlock(brief: WebsiteBrief | null): string {
  return briefContextText(brief);
}

export const BRIEF_EXTRACT_SYSTEM = `You extract factual website-brief signals from raw source material (notes, page text, or CRM fields).

Respond with ONLY a JSON object:
{
  "facts": ["short factual bullets"],
  "services": ["service names mentioned"],
  "audiences": ["audience labels mentioned"],
  "geography": "",
  "toneWords": [""],
  "competitorsNamed": [""],
  "urlsMentioned": [""],
  "conversionHints": [""],
  "openQuestions": [""],
  "unknowns": ["what is not evidenced"]
}

Rules:
- Extract only what is explicitly present or strongly evidenced.
- Prefer empty arrays / "" over invention.
- Keep each string under 200 characters.`;

export const BRIEF_SUGGEST_SYSTEM = `You are a senior web strategist at a design agency. Using extracted facts (and raw source context), draft a structured website brief.

Respond with ONLY a JSON object matching this shape (schemaVersion must be "1.0"):
{
  "schemaVersion": "1.0",
  "org": { "name": "", "oneLiner": "", "sector": "", "geography": "" },
  "brand": { "tone": [""], "constraints": [""], "existingSiteUrl": "" },
  "offer": {
    "services": [{ "name": "", "description": "" }],
    "primaryConversionGoals": [""]
  },
  "audience": {
    "segments": [{ "name": "", "jobsToBeDone": "", "objections": [""] }]
  },
  "conversation": { "questionsTheSiteMustAnswer": [""] },
  "competitors": [{ "name": "", "url": "", "notes": "" }],
  "references": [{ "url": "", "whyThisWorks": "" }],
  "stackPreference": "webflow" | "astro" | "next" | "ozer_sites" | "undecided"
}

Rules:
- Only include facts stated or strongly implied by the input; use empty strings/arrays when unknown — never invent awards, figures, or clients.
- references: up to 3 realistic industry sites worth studying, with one line on whyThisWorks.
- conversation.questionsTheSiteMustAnswer: the visitor questions the site must answer.
- Prefer "undecided" for stackPreference unless the input names a stack.
- Keep string values concise (under 800 characters each).`;

export const SITEMAP_GENERATE_SYSTEM = `You are a senior information architect. You design website sitemaps that convert and rank (SEO + local + LLM answer engines).

Respond with ONLY a valid JSON array — no markdown fences, no commentary, no trailing commas:
[
  {
    "title": "Home",
    "slug": "home",
    "description": "one line on the page's job",
    "pageType": "home",
    "seoIntent": "one line search intent",
    "parentSlug": null,
    "sections": [
      {
        "title": "Hero",
        "description": "purpose + key content in one sentence",
        "sectionType": "hero",
        "componentKey": null
      }
    ]
  }
]

Allowed pageType values: home | service | location | about | contact | blog-index | blog-post | legal | landing | other
Allowed sectionType values: nav | hero | proof | conversion | content | footer

Hard limits (keep the payload small and complete):
- 5–8 pages maximum for a typical business site.
- At most 6 sections per page.
- Keep every string under 120 characters.
- Nest service/location detail pages under their index via parentSlug.
- Every page: shared header (componentKey "site-header"), one conversion section, shared footer (componentKey "site-footer").
- Use componentKey ONLY for repeated sections; repeated sections must share identical title/description.
- Slugs: lowercase kebab-case; home page slug "home".
- Prefer fewer, clearer pages over a huge tree — a complete valid JSON array matters more than coverage.`;

const LIBRARY_KEYS = WEBSITE_SECTION_LIBRARY.map(
  (entry) => `"${entry.key}" (${entry.label}: ${entry.hint})`,
).join(', ');

export const WIREFRAME_GENERATE_SYSTEM = `You are a senior UX designer producing wireframe specs from a sitemap page and brief.

Respond with ONLY a JSON array — one item per sitemap section, in order:
[
  {
    "sitemapSectionTitle": "exact title of the sitemap section this maps to",
    "title": "client-friendly section name",
    "layoutPreset": "full" | "split" | "grid" | "cards" | "cta" | "footer",
    "libraryKey": "one of the library keys below",
    "copyOutline": {
      "headline": "client-facing headline",
      "subhead": "supporting line",
      "bullets": ["optional bullet"],
      "ctaLabel": "button label"
    },
    "copy": {
      "slots": { "headline": "…", "subheadline": "…", "primaryCta": "…" },
      "items": [{ "slots": { "title": "…", "body": "…" } }]
    },
    "contentNotes": "INTERNAL ONLY — layout intent, assets to collect, pitfalls. Never put client-facing copy here."
  }
]

Library keys: ${LIBRARY_KEYS}.

Rules:
- Pick the most fitting libraryKey per section; use "hero-split" or "hero-centered" for heroes, "footer-standard" for footers.
- layoutPreset must be one of: full | split | grid | cards | cta | footer.
- copyOutline is client-shareable suggested copy (headline / subhead / bullets / ctaLabel).
- contentNotes is STRICTLY internal — do not duplicate shareable copy there.
- copy.slots keys should match the section type (headline/subheadline/primaryCta for heroes; heading/body for content; etc.).
- copy.items only for grids/cards (features, services, testimonials, FAQ, pricing, team). 3–4 items.
- copy and copyOutline must be specific to the brief (no lorem, no generic filler).
- Slot values must be the real on-page copy only — never prefix with labels like "Headline:", "Supporting line:", "Primary CTA:", or "Links:".
- Nav CTAs must be a single short button label (e.g. "Get in touch"), never a pipe-separated list of links.
- Keep contentNotes internal-facing and short (1–2 sentences max).`;

export const WIREFRAME_SECTION_REGENERATE_SYSTEM = `You are a senior UX designer regenerating ONE wireframe section.

Respond with ONLY a JSON array containing exactly one object (same shape as full wireframe generate):
[
  {
    "sitemapSectionTitle": "exact title",
    "title": "client-friendly section name",
    "layoutPreset": "full" | "split" | "grid" | "cards" | "cta" | "footer",
    "libraryKey": "library key",
    "copyOutline": { "headline": "", "subhead": "", "bullets": [], "ctaLabel": "" },
    "copy": { "slots": {}, "items": [] },
    "contentNotes": "INTERNAL ONLY notes"
  }
]

Library keys: ${LIBRARY_KEYS}.

Rules:
- copyOutline = client-shareable. contentNotes = internal only.
- No lorem. Ground in the brief + section purpose.`;

export const SITEMAP_SEO_PAGES_SYSTEM = `${SITEMAP_GENERATE_SYSTEM}

Mode: add missing SEO pages only.
Return ONLY pages that are missing relative to the current sitemap (service, location, comparison, FAQ, legal).
Every returned page must include a non-empty seoIntent.
Do not return pages whose slug already exists.`;

export const SITEMAP_VARIANTS_SYSTEM = `${SITEMAP_GENERATE_SYSTEM}

Mode: propose local / service variant pages.
From the brief geography + services, propose a service-area matrix as CHILD pages.
- Each variant page: pageType "service" or "location", parentSlug set to the relevant parent index page.
- Fill seoIntent with the local/service search intent.
- Prefer 4–12 focused variant pages (not every possible combination if that would balloon).
- Include lean sections (hero, proof or content, conversion) plus shared header/footer componentKeys.`;

export const STYLE_SUGGEST_SYSTEM = `You are a brand-led art director. From a website brief and moodboard references you propose a D1 style token system.

Respond with ONLY a JSON object:
{
  "schemaVersion": "1.0",
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "neutrals": ["#lightest", "#…", "#…", "#…", "#…", "#…", "#darkest"],
    "success": "#hex",
    "warning": "#hex",
    "danger": "#hex"
  },
  "typography": {
    "displayFamily": "Google Font or known family name",
    "bodyFamily": "Google Font or known family name",
    "typeScale": { "base": 16, "ratio": 1.25 },
    "weights": { "regular": 400, "medium": 500, "bold": 700 }
  },
  "radius": {
    "none": "0px",
    "sm": "0.375rem",
    "md": "0.75rem",
    "lg": "1.25rem",
    "full": "9999px"
  },
  "spacingDensity": "compact" | "comfortable" | "spacious",
  "photographyDirection": "2-3 sentences on imagery style",
  "buttons": { "style": "pill" | "rounded" | "square" },
  "rationale": "2-3 sentences on why this direction fits",
  "extractedPaletteNotes": "optional notes on colours spotted in moodboard URLs"
}

Rules:
- neutrals: 5–7 steps from lightest surface to darkest ink.
- primary drives CTAs; accent is highlight; secondary supports.
- Avoid clichés: no purple-on-white default, no generic Inter-only stacks.
- Fonts must pair well; one family is fine (display + body same family).
- Ground colour/font choices in the brief tone + any moodboard cues provided.`;

export const SEO_GENERATE_SYSTEM = `You are a technical SEO + GEO + AEO specialist. For one website page you produce a search readiness plan (Prompt E1).

Respond with ONLY a JSON object matching this shape:
{
  "keywords": { "primary": "", "secondary": ["", ""] },
  "meta": { "title": "max 60 chars", "description": "max 155 chars" },
  "headingOutline": [{ "level": 1, "text": "" }, { "level": 2, "text": "" }],
  "internalLinks": [{ "toSlug": "about", "anchorSuggestion": "" }],
  "canonicalRule": "self-canonical unless pagination/aliases",
  "slugRule": "kebab-case slug guidance for this page",
  "imageAltPlan": [{ "imageRole": "hero", "altPattern": "…" }],
  "schemaTypes": ["Organization", "FAQPage"],
  "geo": {
    "isLocationPage": false,
    "nap": "",
    "serviceArea": [],
    "gbpCues": [],
    "localFaq": [{ "question": "", "draftAnswer": "" }]
  },
  "aeo": {
    "answerBlocks": [{ "question": "", "draftAnswer": "citation-friendly 2-4 sentences" }],
    "definitions": [],
    "entityNotes": "org → services → locations graph notes"
  },
  "technical": { "indexable": true, "ogImagePlan": "" }
}

Rules:
- Ground everything in the brief + page purpose; never invent business facts.
- headingOutline must include one H1 (level 1) then H2/H3s.
- answerBlocks: 2–4 real questions a person or LLM would ask about this page.
- schemaTypes from schema.org only.`;

export const SEO_ANSWER_BLOCKS_SYSTEM = `You draft answer-engine (AEO) FAQ blocks for one website page.

Respond with ONLY a JSON object:
{
  "answerBlocks": [
    { "question": "", "draftAnswer": "2–4 citation-friendly sentences grounded in the brief" }
  ]
}

Rules:
- 3–5 blocks max.
- Never invent NAP, prices, or unverifiable claims — mark unknowns as TODO.
- Match the page's topic and the organisation's tone.`;

export function sitemapContextBlock(sitemap: WebsiteSitemapPage[]): string {
  if (sitemap.length === 0) return 'No sitemap yet.';
  return sitemap
    .map((page) => {
      const sections = page.sections
        .map((section) => `    - ${section.title}: ${section.description}`)
        .join('\n');
      return `- ${page.title} (/${page.slug}${page.pageType ? `, ${page.pageType}` : ''})${page.seoIntent ? ` — intent: ${page.seoIntent}` : ''}\n${sections}`;
    })
    .join('\n');
}
