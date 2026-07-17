import type { PhaseTemplatePhase } from '~/home/[account]/jobs/_lib/schema/project-phases.schema';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

export const WEBSITE_DESIGN_TEMPLATE_NAME = 'Website design';

export const WEBSITE_DESIGN_TEMPLATE: {
  name: string;
  description: string;
  phases: PhaseTemplatePhase[];
} = {
  name: WEBSITE_DESIGN_TEMPLATE_NAME,
  description:
    'Site Studio workflow — brief → sitemap → wireframes → design → SEO → export → build.',
  phases: [
    {
      name: 'Brief',
      colour: '#3B82F6',
      is_milestone: false,
      planning_tab: 'brief',
      description:
        'Structured brief: brand, offer, audience, references, tone, goals — powers every AI step.',
      page_content: `# Brief

## Goal
Capture **one source of truth** for this build. Every later step (sitemap, wireframes, copy, SEO) is generated from this brief, so make it specific.

## What to fill in
- Org / brand / offer / audience / geography
- The conversation the site answers (jobs-to-be-done, objections)
- Competitors + **3 reference websites** with a one-line "why this works"
- Tone, constraints, conversion goals
- Target stack: Webflow / Astro / Next.js (or undecided)

## AI assist
Open **Website → Brief** and paste discovery notes or the client's current URL — AI suggests every field. Review and correct before moving on; garbage in, generic site out.

## Checklist
- [ ] Brief fields reviewed (not just AI-filled)
- [ ] 3 reference sites with notes
- [ ] Conversion goals agreed with client
- [ ] Target stack picked (drives the export pack)

## Deliverable
A completed brief the client has sanity-checked.
`,
    },
    {
      name: 'Sitemap',
      colour: '#6366F1',
      is_milestone: false,
      planning_tab: 'sitemap',
      description:
        'Canvas sitemap — every page and section, colour-coded, with repeating components.',
      page_content: `# Sitemap

## Goal
Map **every page** and its sections on the canvas before any design work.

## Process
1. Open **Website → Sitemap** and click **Suggest from brief** — AI proposes pages and sections.
2. Refine: rename, reorder, nest child pages under parents.
3. Set a **page type** (home, service, location, blog, legal…) — this drives SEO templates later.
4. Colour-code sections by job: nav / hero / proof / conversion / content / footer.
5. Mark shared sections (header, footer, CTA band) as **repeating components** — edit once, update everywhere.

## Rules
- No design tools until the sitemap is approved.
- Keep page names client-friendly.
- Ask AI to "Add missing SEO pages" for service/location coverage.

## Checklist
- [ ] All pages agreed with client (share the sitemap link)
- [ ] Page types set
- [ ] Repeating components marked
- [ ] Pages marked Approved
`,
    },
    {
      name: 'Wireframes',
      colour: '#8B5CF6',
      is_milestone: false,
      planning_tab: 'wireframe',
      description:
        'Section-by-section structure with library layouts and AI copy outlines.',
      page_content: `# Wireframes

## Goal
Turn each sitemap section into a wireframe block with a **section library layout** and a suggested copy outline.

## Process
1. Open **Website → Wireframes**, sync from sitemap.
2. Pick a library section per block (hero variants, logo cloud, FAQ, pricing, team…).
3. Use **Generate for page** to draft copy outlines from the brief — then replace with real client content.
4. Keep internal notes separate from client-facing copy.

## Rules
- Real content beats placeholders — collect missing copy in **Content docs**.
- Every page needs a conversion section before the footer.

## Checklist
- [ ] Every sitemap page has wireframe sections
- [ ] Library layout chosen per section
- [ ] Copy outlines reviewed (no lorem)
- [ ] Client reviewed wireframes (share link)
`,
    },
    {
      name: 'Design',
      colour: '#EC4899',
      is_milestone: false,
      planning_tab: 'design',
      description:
        'Style system: 4-role palette, type, radius, spacing, photography direction.',
      page_content: `# Design

## Goal
Lock a **style system** the exports can use verbatim.

## The 4 colour roles
1. **Canvas** — neutrals, base layer
2. **Atmosphere** — subtle backgrounds / gradients
3. **Accent** — buttons, icons, highlights
4. **Contrast** — headings and body text

## Process
1. Open **Website → Design**. Add moodboard references (URLs + why).
2. Use **Suggest from brief** to draft tokens from references + industry.
3. Set heading/body fonts (one font max; two only for serif + sans pairing).
4. Choose radius, spacing density, and photography direction.
5. **Lock tokens** when done — exports and prompts use them as-is.

## Figma escape hatch
For brand-heavy work, export style tokens + wireframe outline from the **Export** tab and build frames in Figma.

## Checklist
- [ ] 4-role palette documented
- [ ] Fonts + weights locked
- [ ] Photography direction written
- [ ] Tokens locked
`,
    },
    {
      name: 'SEO',
      colour: '#14B8A6',
      is_milestone: false,
      planning_tab: 'seo',
      description:
        'Search readiness per page: keywords, meta, local SEO, answer blocks for LLM citation.',
      page_content: `# SEO / GEO / AEO

## Goal
Every page ships with search intent, metadata, and **answer blocks** LLMs can cite.

## Per page (Website → Search)
- Primary + secondary keywords, title, meta description
- H1 and heading outline, internal link plan
- Schema.org types (Organization, Service, LocalBusiness, FAQ…)
- **Local (GEO):** location pages, NAP consistency, service areas
- **AEO:** FAQ / entity answer blocks, citation-friendly definitions

## AI assist
"Suggest for page" drafts everything from the brief + sitemap. Approve before export.

## Site-wide
The Export tab generates a draft \`llms.txt\` and JSON-LD blocks from these fields.

## Checklist
- [ ] Every page has keywords + meta
- [ ] FAQ/answer blocks on key pages
- [ ] Local pages covered (if relevant)
- [ ] Schema types set
`,
    },
    {
      name: 'Export',
      colour: '#F97316',
      is_milestone: false,
      planning_tab: 'export',
      description:
        'Generate the build pack: Webflow Client-First, Astro or Next starter, Cursor/Claude prompts.',
      page_content: `# Export

## Goal
Produce the pack a developer (or you + Cursor) builds from **the same day**.

## What the pack contains
1. **Webflow Client-First 3.0** — class naming + page/section structure guide
2. **Astro starter** — pages, section components, content collections
3. **Next.js starter** — App Router pages + typed content config
4. **Cursor / Claude prompt pack** — per-page build prompts with tokens, section props, and SEO constraints
5. Style tokens JSON + Figma outline
6. \`llms.txt\` draft + JSON-LD blocks

## Process
1. Open **Website → Export** and pick the target stack (from the brief).
2. Copy or download each artefact.
3. For Webflow: follow the Client-First workflow doc; for code: scaffold with the prompt pack in Cursor.

## Checklist
- [ ] Sitemap + wireframes approved before export
- [ ] Tokens locked
- [ ] Export pack handed to the builder
`,
    },
    {
      name: 'Build',
      colour: '#FF5C34',
      is_milestone: true,
      planning_tab: 'build',
      description:
        'Implement from the export pack — visual references, not text-only prompts.',
      page_content: `# Build

## Prerequisites
Approved sitemap + wireframes, locked style tokens, SEO fields, export pack generated.

## Building with AI
- Feed the **prompt pack** into Cursor/Claude — never text-only prompts without the pack.
- Paste real client content per section before generating.
- Match sections to the library components in the export.

## Responsive
1. Ask AI to make the site responsive first.
2. If a section breaks on mobile, sketch a quick reference frame and re-prompt.

## Launch checklist
- [ ] All sitemap pages built
- [ ] Content matches approved docs
- [ ] Meta titles/descriptions + JSON-LD in place
- [ ] llms.txt deployed
- [ ] Mobile checked on key breakpoints
- [ ] Staging URL shared with client
- [ ] Update website record: domain, stack, repo links
`,
    },
  ],
};

/** Map phase name → planning tab for PM deep links */
export function websitePlanningTabForPhase(
  phaseName: string,
): WebsitePlanningTab | null {
  const phase = WEBSITE_DESIGN_TEMPLATE.phases.find(
    (item) => item.name.toLowerCase() === phaseName.trim().toLowerCase(),
  );
  return phase?.planning_tab ?? null;
}
