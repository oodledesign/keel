import type { PhaseTemplatePhase } from '~/app/home/[account]/jobs/_lib/schema/project-phases.schema';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

export const WEBSITE_DESIGN_TEMPLATE_NAME = 'Website design';

export const WEBSITE_DESIGN_TEMPLATE: {
  name: string;
  description: string;
  phases: PhaseTemplatePhase[];
} = {
  name: WEBSITE_DESIGN_TEMPLATE_NAME,
  description:
    'AI web design workflow — business context → sitemap → wireframes → content → design → build.',
  phases: [
    {
      name: 'Business context',
      colour: '#3B82F6',
      is_milestone: false,
      planning_tab: 'overview',
      description:
        'Set visual standard and references before opening any design tool.',
      page_content: `# Business context

## Goal
Define **what great looks like** for this client before you touch Figma, Relume, or any AI builder.

## The one question
> What does great look like for this client, in this industry?

Find **three reference websites** that answer that. Those become your visual standard — everything you build gets measured against them.

## Taste & references
Taste is a skill, not a gift. Save what stops you and write one sentence about why.

**Reference tools:** Pinterest, Are.na, Cosmos, Behance, Awwwards, Land-book, Godly.

## AI workflow (pick per project)
1. **Full workflow** — design in Figma first, then AI builds it (best for high-ticket / precision).
2. **Mixed approach** — screenshots, Figma sections, or moodboards as context (faster, still directed).
3. **Avoid winging it** — text-only prompts without references burn credits and produce generic sites.

## Checklist
- [ ] Client niche / industry documented
- [ ] 3 reference sites saved (links + notes on why they work)
- [ ] Moodboard started (colours, photography feel, layout patterns)
- [ ] Chosen workflow: Full / Mixed
- [ ] Link to **Website → Planning → Content docs** for reference notes

## Deliverable
A short brief: who the client is, who they serve, what feeling the site should communicate, and links to 3 reference sites.
`,
    },
    {
      name: 'Sitemaps',
      colour: '#6366F1',
      is_milestone: false,
      planning_tab: 'sitemap',
      description: 'Map every page before design — ~5 minutes with the client.',
      page_content: `# Sitemaps

## Goal
List **every page** the site needs before any design work.

## Process
1. Ask the client: *What pages do you need?*
2. Typical pages: Home, About, Services, Contact — plus blog, portfolio, locations, etc. as needed.
3. For each page, list **sections** (next phase goes deeper).

## Example (clinic)
- **Home** — Hero, Why choose us, Meet the doctors, Services, Testimonials, CTA, Footer
- **About** — Story, Team, Values
- **Services** — Service list, detail blocks
- **Contact** — Form, location, hours

## Rules
- No design tools until the sitemap exists.
- Keep page names client-friendly (Home, not \`/index\`).
- Note pages that share sections (e.g. service detail template).

## Tool
Open **Website → Planning → Sitemap** and add each page with section titles + one-line descriptions.

## Checklist
- [ ] All pages agreed with client
- [ ] Each page has a working title
- [ ] Priority order set (build home first)
`,
    },
    {
      name: 'Wireframes',
      colour: '#8B5CF6',
      is_milestone: false,
      planning_tab: 'wireframe',
      description: 'Section structure per page — layout intent, not visual design.',
      page_content: `# Wireframes

## Goal
Define **sections inside each page** with enough detail to select components or design in Figma.

## Process
For every page in the sitemap:
1. List sections top → bottom
2. One sentence per section: purpose + key content
3. Pick a **layout pattern** (full width, split, grid, cards, CTA band, footer)

## Example — Home (clinic)
| Section | Purpose |
|---------|---------|
| Hero | Headline, subhead, primary CTA, trust strip |
| Why choose us | 3–4 differentiators |
| Meet the doctors | Photos, names, specialties |
| Services | Core services with links |
| Testimonials | Social proof |
| Final CTA | Book / contact |
| Footer | Nav, contact, legal |

## Time box
~30 minutes for all pages. This saves hours of iteration later.

## Tool
Open **Website → Planning → Wireframes** — synced from your sitemap. Add layout notes per section.

## Checklist
- [ ] Every sitemap page has wireframe sections
- [ ] Layout pattern chosen per section
- [ ] No placeholder lorem — note what content type each block needs
`,
    },
    {
      name: 'Client content',
      colour: '#14B8A6',
      is_milestone: false,
      planning_tab: 'content',
      description: 'Real copy and assets from the client — AI cannot invent this.',
      page_content: `# Client content

## Goal
Fill each wireframe section with **real content** from the client.

## What to collect
- **Hero:** headline, subheadline, CTA labels, trust indicators
- **Team:** names, roles, bios, photos
- **Services:** titles, descriptions, pricing hints if applicable
- **Testimonials:** real quotes, names, roles
- **Contact:** address, phone, email, hours, form fields

## Rules
- Do not design with placeholder copy you expect AI to replace.
- Organise content **by section** (match wireframe structure).
- Flag missing items — block build until critical content exists.

## Tool
Use **Website → Planning → Content docs** — one doc per page or section group. Markdown supported.

## Checklist
- [ ] Content doc per major page
- [ ] All hero / CTA copy approved
- [ ] Team photos received or shoot scheduled
- [ ] Legal pages (privacy, terms) assigned
`,
    },
    {
      name: 'Design',
      colour: '#EC4899',
      is_milestone: false,
      planning_tab: 'content',
      description: 'Colour system (canvas, atmosphere, accent, contrast) + imagery direction.',
      page_content: `# Design — colour & imagery

## Colour system (4 roles)
Every colour needs a job:

1. **Canvas** — neutrals (white, off-white, light gray). Base layer.
2. **Atmosphere** — subtle backgrounds, gradients, section dividers. Sets mood.
3. **Accent** — buttons, icons, highlights. Guides the eye.
4. **Contrast** — headings, body text. Readability & hierarchy.

Build from **references**, not personal preference. Collect industry moodboards first.

## Imagery (two categories)
1. **Contextual** — service in action (experience, emotion)
2. **Team** — portraits that build trust (consistent lighting & background)

Create moodboards before generating any AI images. References beat long prompts.

## Common mistakes
- Competing accent colours on the same section
- Yellow/light backgrounds behind photos (loses contrast)
- Style over function — if readability suffers, change it

## Checklist
- [ ] 4-role palette documented (hex values)
- [ ] Contextual photo moodboard
- [ ] Team photo moodboard / shoot plan
- [ ] Client brand colours integrated where required
`,
    },
    {
      name: 'Typography',
      colour: '#A855F7',
      is_milestone: false,
      planning_tab: 'content',
      description: 'One font max (two if serif + sans pairing). Type communicates before words.',
      page_content: `# Typography

## Rule
**One font maximum.** Two only if pairing serif headlines + sans body — never more.

## Choose by feeling
- **Modern / technical** → clean geometric sans (Inter, Geist, DM Sans)
- **Premium / elegant** → serif (Playfair, Instrument Serif, Lora)
- **Warm / approachable** → humanist sans (Open Sans, Manrope)

## Process
1. Open Google Fonts (or brand font if supplied)
2. Type sample headline + body in preview
3. Does it match the reference moodboard? → lock it in.

## Details that matter
- Hierarchy via size + weight, not extra fonts
- ALL CAPS buttons add weight — use sparingly for contrast
- Line length & spacing affect premium feel as much as font choice

## Document
Record in content docs:
- Font family name(s)
- Weights used (400 body, 500 nav, 700 headings)
- Sample H1 / H2 / body sizes

## Checklist
- [ ] Primary font chosen
- [ ] Optional secondary font (if pairing)
- [ ] Weights & scale documented
- [ ] Matches reference sites from Business context phase
`,
    },
    {
      name: 'Build',
      colour: '#FF5C34',
      is_milestone: true,
      planning_tab: 'overview',
      description: 'Implement with AI — visual references, not text-only prompts.',
      page_content: `# Build

## Prerequisites
You should have completed:
- Sitemap + wireframes + client content
- Typography + colour + imagery direction

## Building with AI
- **Never** rely on text-only prompts — use wireframes, Figma, screenshots, moodboards.
- Match sitemap sections to template components or custom sections.
- Paste **real client content** into each section before generating.

## Responsive
1. Ask AI to make the site responsive first (saves hours).
2. If a section breaks on mobile, sketch a quick Figma frame and send as reference.

## Launch checklist
- [ ] All sitemap pages built
- [ ] Content matches approved docs
- [ ] Mobile checked on key breakpoints
- [ ] Forms / analytics / SEO basics
- [ ] Staging URL shared with client
- [ ] Update website record: domain, stack, repo links

## Handover
Link live site, CMS access, and care plan (if applicable) in the website record.
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
