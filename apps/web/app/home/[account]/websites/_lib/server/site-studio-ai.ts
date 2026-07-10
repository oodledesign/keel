import 'server-only';

import type {
  WebsiteBrief,
  WebsiteSitemapPage,
} from '~/lib/websites/planning-types';
import { WEBSITE_SECTION_LIBRARY } from '~/lib/websites/section-library';

/**
 * Extract the first JSON object/array from an LLM response.
 * Claude sometimes wraps JSON in prose or fences even when asked not to.
 */
export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;

  const firstBrace = candidate.search(/[[{]/);
  if (firstBrace === -1) {
    throw new Error('AI response did not contain JSON');
  }

  const open = candidate[firstBrace];
  const close = open === '[' ? ']' : '}';
  const lastClose = candidate.lastIndexOf(close);
  if (lastClose === -1) {
    throw new Error('AI response did not contain complete JSON');
  }

  const raw = candidate.slice(firstBrace, lastClose + 1);
  return JSON.parse(raw) as T;
}

export function briefContextBlock(brief: WebsiteBrief | null): string {
  if (!brief) return 'No structured brief captured yet.';

  const refs = brief.references
    .map((ref) => `- ${ref.url} — ${ref.why}`)
    .join('\n');

  return [
    `Organisation: ${brief.orgName || 'n/a'}`,
    `Brand summary: ${brief.brandSummary || 'n/a'}`,
    `Offer: ${brief.offer || 'n/a'}`,
    `Audience: ${brief.audience || 'n/a'}`,
    `Geography: ${brief.geography || 'n/a'}`,
    `Jobs-to-be-done: ${brief.jobsToBeDone || 'n/a'}`,
    `Objections to answer: ${brief.objections || 'n/a'}`,
    `Competitors: ${brief.competitors || 'n/a'}`,
    `Reference sites:\n${refs || '- none'}`,
    `Tone: ${brief.tone || 'n/a'}`,
    `Constraints: ${brief.constraints || 'n/a'}`,
    `Conversion goals: ${brief.conversionGoals || 'n/a'}`,
    `Target stack: ${brief.targetStack}`,
    `CMS needed: ${brief.cmsNeeded ? 'yes' : 'no'}`,
  ].join('\n');
}

export const BRIEF_SUGGEST_SYSTEM = `You are a senior web strategist at a design agency. From raw discovery notes and/or a client website URL, you draft a structured website brief.

Respond with ONLY a JSON object matching exactly this shape (all string values, keep each under 800 characters, references max 3 items):
{
  "orgName": "",
  "brandSummary": "",
  "offer": "",
  "audience": "",
  "geography": "",
  "jobsToBeDone": "",
  "objections": "",
  "competitors": "",
  "references": [{ "url": "", "why": "" }],
  "tone": "",
  "constraints": "",
  "conversionGoals": "",
  "targetStack": "webflow" | "astro" | "next" | "undecided",
  "cmsNeeded": true | false
}

Rules:
- Only include facts stated or strongly implied by the input; write "" when unknown, never invent specifics like awards or figures.
- references: suggest realistic well-known sites in the client's industry worth studying, with one line on why.
- jobsToBeDone: the conversation the site must answer for a visitor.
- Prefer "undecided" for targetStack unless the input names one.`;

export const SITEMAP_GENERATE_SYSTEM = `You are a senior information architect. You design website sitemaps that convert and rank (SEO + local + LLM answer engines).

Respond with ONLY a JSON array of pages:
[
  {
    "title": "Home",
    "slug": "home",
    "description": "one line on the page's job",
    "pageType": "home" | "service" | "location" | "about" | "contact" | "blog-index" | "blog-post" | "legal" | "landing" | "other",
    "seoIntent": "one line search intent",
    "parentSlug": null or "slug-of-parent-page",
    "sections": [
      {
        "title": "Hero",
        "description": "purpose + key content in one sentence",
        "sectionType": "nav" | "hero" | "proof" | "conversion" | "content" | "footer",
        "componentKey": null or a shared key like "site-header", "site-footer", "cta-band"
      }
    ]
  }
]

Rules:
- 5–12 pages for a typical business site; nest service/location detail pages under their index page via parentSlug.
- Every page: sections top-to-bottom including a shared header (componentKey "site-header"), one conversion section, and shared footer (componentKey "site-footer").
- Use componentKey ONLY for sections repeated across pages (header, footer, CTA band, service card row). Repeated sections must share identical title/description.
- Include SEO-driven pages the business needs (service pages, location pages, FAQ/legal) based on the brief.
- Slugs: lowercase kebab-case, home page slug "home".`;

const LIBRARY_KEYS = WEBSITE_SECTION_LIBRARY.map(
  (entry) => `"${entry.key}" (${entry.label}: ${entry.hint})`,
).join(', ');

export const WIREFRAME_GENERATE_SYSTEM = `You are a senior UX designer producing wireframe specs from a sitemap page and brief.

Respond with ONLY a JSON array — one item per sitemap section, in order:
[
  {
    "sitemapSectionTitle": "exact title of the sitemap section this maps to",
    "title": "client-friendly section name",
    "libraryKey": "one of the library keys below",
    "copyOutline": "suggested copy outline: headline, supporting line, CTA labels — 2-5 lines, written for this client",
    "contentNotes": "internal notes: layout intent, content to collect, pitfalls"
  }
]

Library keys: ${LIBRARY_KEYS}.

Rules:
- Pick the most fitting libraryKey per section; use "hero-split" or "hero-centered" for heroes, "footer-standard" for footers.
- copyOutline must be specific to the brief (no lorem, no generic filler).
- Keep contentNotes internal-facing and copyOutline client-facing.`;

export const STYLE_SUGGEST_SYSTEM = `You are a brand-led art director. From a website brief and moodboard references you propose a style system.

Respond with ONLY a JSON object:
{
  "canvas": "#hex",
  "atmosphere": "#hex",
  "accent": "#hex",
  "contrast": "#hex",
  "secondary": "#hex",
  "headingFont": "Google Font name",
  "bodyFont": "Google Font name",
  "typeScale": "compact" | "regular" | "display",
  "radius": "sharp" | "soft" | "round",
  "spacingDensity": "tight" | "regular" | "airy",
  "photographyDirection": "2-3 sentences on imagery style",
  "rationale": "2-3 sentences on why this direction fits"
}

Rules:
- canvas = neutral base, atmosphere = subtle section background, accent = buttons/highlights, contrast = text.
- Avoid clichés: no purple-on-white default, no generic system fonts.
- Fonts must pair well; one family is fine (heading + body same family, different weights).`;

export const SEO_GENERATE_SYSTEM = `You are a technical SEO + answer-engine-optimisation specialist. For one website page you produce search readiness fields.

Respond with ONLY a JSON object:
{
  "primaryKeyword": "",
  "secondaryKeywords": "comma separated",
  "title": "max 60 chars",
  "metaDescription": "max 155 chars",
  "h1": "",
  "headingOutline": "H2/H3 outline, one heading per line prefixed H2: or H3:",
  "internalLinks": "pages this should link to and why, one per line",
  "canonicalNotes": "",
  "imageAltPlan": "key images + alt text guidance",
  "schemaTypes": ["Organization", "FAQPage"],
  "localSeo": "location/NAP/service-area guidance if relevant, else \\"\\"",
  "answerBlocks": [{ "question": "", "answer": "citation-friendly 2-4 sentence answer" }],
  "entityNotes": "how this page fits the entity graph (org -> services -> locations)"
}

Rules:
- answerBlocks: 2-4 question/answer pairs a person or LLM would actually ask about this page's topic.
- Ground everything in the provided brief and page purpose; never invent business facts.
- schemaTypes from schema.org only.`;

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
