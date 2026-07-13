import 'server-only';

import type {
  WebsiteBrief,
  WebsiteSitemapPage,
} from '~/lib/websites/planning-types';
import { WEBSITE_SECTION_LIBRARY } from '~/lib/websites/section-library';

export { extractJson } from '~/lib/websites/extract-json';

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
    "libraryKey": "one of the library keys below",
    "copyOutline": "2-5 lines: headline, supporting line, CTA labels — specific to this client",
    "copy": {
      "slots": { "headline": "…", "subheadline": "…", "primaryCta": "…" },
      "items": [{ "slots": { "title": "…", "body": "…" } }]
    },
    "contentNotes": "internal notes: layout intent, content to collect, pitfalls"
  }
]

Library keys: ${LIBRARY_KEYS}.

Rules:
- Pick the most fitting libraryKey per section; use "hero-split" or "hero-centered" for heroes, "footer-standard" for footers.
- copy.slots keys should match the section type (headline/subheadline/primaryCta for heroes; heading/body for content; etc.).
- copy.items only for grids/cards (features, services, testimonials, FAQ, pricing, team). 3–4 items.
- copy and copyOutline must be specific to the brief (no lorem, no generic filler).
- Slot values must be the real on-page copy only — never prefix with labels like "Headline:", "Supporting line:", "Primary CTA:", or "Links:".
- Nav CTAs must be a single short button label (e.g. "Get in touch"), never a pipe-separated list of links.
- Keep contentNotes internal-facing and short (1–2 sentences max).`;

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
