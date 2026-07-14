/**
 * Astro starter pack (Prompt D2).
 *
 * Consumers SiteStudioExport ONLY — never reads the database.
 * Emits a zip-ready Astro project: pages, section components (CSS vars),
 * content collections seeded from copy outlines, tokens.css, README.
 * Free CMS path = content collections. Decable is noted as optional follow-up only.
 */
import {
  type ExportPage,
  type ExportSectionInstance,
  type ExportSeoPage,
  type SiteStudioExport,
  assertCompatibleExportSchemaVersion,
} from '../export-contract';
import {
  type ExportPackFile,
  firstOutlineLine,
  packTokensCss,
  pageRoute,
  projectSlug,
  sectionComponentName,
  sectionsForPage,
  slugify,
} from './pack-utils';
import {
  type SeoGeneratorOptions,
  generateJsonLd,
  generateLlmsTxt,
} from './seo-generators';

export type AstroPack = {
  files: ExportPackFile[];
};

function seoForPage(
  exp: SiteStudioExport,
  page: ExportPage,
): ExportSeoPage | null {
  return exp.seo?.pages.find((row) => row.pageSlug === page.slug) ?? null;
}

function sectionProps(section: ExportSectionInstance): {
  heading: string;
  body: string;
  cta: string;
} {
  const slots =
    section.props &&
    typeof section.props === 'object' &&
    'slots' in section.props &&
    section.props.slots &&
    typeof section.props.slots === 'object'
      ? (section.props.slots as Record<string, unknown>)
      : {};

  const heading = String(
    slots.headline ??
      slots.heading ??
      firstOutlineLine(section.copyOutline, section.sectionType),
  );
  const body = String(
    slots.subheadline ?? slots.body ?? (section.copyOutline.trim() || heading),
  );
  const cta = String(slots.cta ?? slots.primaryCta ?? 'Learn more');

  return { heading, body, cta };
}

function astroSectionComponent(name: string): string {
  const layouts: Record<string, string> = {
    SiteNav: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Site', cta = 'Contact' } = Astro.props;
---
<header class="section site-nav">
  <div class="container nav-row">
    <a class="logo" href="/">{heading}</a>
    <a class="button" href="#">{cta}</a>
  </div>
</header>
<style>
  .site-nav { padding-block: var(--sb-space-4); border-bottom: 1px solid var(--sb-border); }
  .nav-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sb-space-4); }
  .logo { font-family: var(--sb-font-display); font-weight: var(--sb-font-weight-bold); color: var(--sb-ink); text-decoration: none; }
</style>`,
    HeroSplit: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta } = Astro.props;
---
<section class="section hero-split">
  <div class="container split">
    <div>
      {heading && <h1>{heading}</h1>}
      {body && <p class="lede">{body}</p>}
      {cta && <a class="button" href="#">{cta}</a>}
    </div>
    <div class="media" aria-hidden="true"></div>
  </div>
</section>
<style>
  .split { display: grid; gap: var(--sb-space-8); align-items: center; }
  @media (min-width: 768px) { .split { grid-template-columns: 1.1fr 0.9fr; } }
  .lede { color: var(--sb-ink-muted); max-width: 36rem; }
  .media { min-height: 16rem; border-radius: var(--sb-radius-lg); background: var(--sb-atmosphere); }
</style>`,
    HeroCentered: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta } = Astro.props;
---
<section class="section hero-centered">
  <div class="container center">
    {heading && <h1>{heading}</h1>}
    {body && <p class="lede">{body}</p>}
    {cta && <a class="button" href="#">{cta}</a>}
  </div>
</section>
<style>
  .center { text-align: center; max-width: 48rem; }
  .lede { color: var(--sb-ink-muted); }
</style>`,
    HeroForm: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta = 'Submit' } = Astro.props;
---
<section class="section hero-form">
  <div class="container split">
    <div>
      {heading && <h1>{heading}</h1>}
      {body && <p class="lede">{body}</p>}
    </div>
    <form class="card" onsubmit="return false;">
      <label>Email <input type="email" name="email" required /></label>
      <button class="button" type="submit">{cta}</button>
    </form>
  </div>
</section>
<style>
  .split { display: grid; gap: var(--sb-space-8); }
  @media (min-width: 768px) { .split { grid-template-columns: 1fr 1fr; } }
  .lede { color: var(--sb-ink-muted); }
  .card { display: grid; gap: var(--sb-space-3); padding: var(--sb-space-6); border-radius: var(--sb-radius-md); background: var(--sb-surface); border: 1px solid var(--sb-border); }
  input { width: 100%; padding: var(--sb-space-3); border-radius: var(--sb-radius-sm); border: 1px solid var(--sb-border); }
</style>`,
    FeatureGrid: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body } = Astro.props;
const items = (body ?? '').split(/\\n|;/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
---
<section class="section feature-grid">
  <div class="container">
    {heading && <h2>{heading}</h2>}
    <div class="grid">
      {(items.length ? items : ['Item one', 'Item two', 'Item three']).map((item) => (
        <article class="card"><h3>{item}</h3></article>
      ))}
    </div>
  </div>
</section>
<style>
  .grid { display: grid; gap: var(--sb-space-4); margin-top: var(--sb-space-6); }
  @media (min-width: 768px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  .card { padding: var(--sb-space-6); border-radius: var(--sb-radius-md); background: var(--sb-surface); border: 1px solid var(--sb-border); }
</style>`,
    FeatureAlternating: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta } = Astro.props;
---
<section class="section feature-alt">
  <div class="container split">
    <div class="media" aria-hidden="true"></div>
    <div>
      {heading && <h2>{heading}</h2>}
      {body && <p>{body}</p>}
      {cta && <a class="button" href="#">{cta}</a>}
    </div>
  </div>
</section>
<style>
  .split { display: grid; gap: var(--sb-space-8); align-items: center; }
  @media (min-width: 768px) { .split { grid-template-columns: 1fr 1fr; } }
  .media { min-height: 12rem; border-radius: var(--sb-radius-lg); background: var(--sb-atmosphere); }
</style>`,
    LogoCloud: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Trusted by' } = Astro.props;
---
<section class="section logo-cloud">
  <div class="container">
    <p class="eyebrow">{heading}</p>
    <div class="logos" aria-hidden="true">
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</section>
<style>
  .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--sb-font-size-sm); color: var(--sb-ink-muted); }
  .logos { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sb-space-4); margin-top: var(--sb-space-4); }
  .logos span { height: 2.5rem; border-radius: var(--sb-radius-sm); background: var(--sb-atmosphere); }
</style>`,
    Testimonials: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'What people say', body } = Astro.props;
---
<section class="section testimonials">
  <div class="container">
    <h2>{heading}</h2>
    <blockquote><p>{body || 'A short testimonial goes here.'}</p></blockquote>
  </div>
</section>
<style>
  blockquote { margin: var(--sb-space-6) 0 0; padding: var(--sb-space-6); border-radius: var(--sb-radius-md); background: var(--sb-surface); border-left: 4px solid var(--sb-color-primary); }
</style>`,
    StatsBar: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body } = Astro.props;
const stats = (body ?? '100+|Projects;50+|Years;1k+|People').split(';').map((s) => s.trim()).filter(Boolean);
---
<section class="section stats-bar">
  <div class="container grid">
    {stats.map((stat) => {
      const [value, label] = stat.split('|');
      return (
        <div>
          <p class="value">{value}</p>
          <p class="label">{label || heading || 'Stat'}</p>
        </div>
      );
    })}
  </div>
</section>
<style>
  .grid { display: grid; gap: var(--sb-space-4); text-align: center; }
  @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  .value { font-family: var(--sb-font-display); font-size: var(--sb-font-size-2xl); margin: 0; }
  .label { color: var(--sb-ink-muted); margin: var(--sb-space-2) 0 0; }
</style>`,
    PricingTable: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Pricing', body, cta = 'Get started' } = Astro.props;
---
<section class="section pricing">
  <div class="container">
    <h2>{heading}</h2>
    {body && <p class="lede">{body}</p>}
    <div class="card">
      <p class="price">Custom</p>
      <a class="button" href="#">{cta}</a>
    </div>
  </div>
</section>
<style>
  .lede { color: var(--sb-ink-muted); }
  .card { margin-top: var(--sb-space-6); padding: var(--sb-space-8); border-radius: var(--sb-radius-lg); border: 1px solid var(--sb-border); background: var(--sb-surface); max-width: 24rem; }
  .price { font-family: var(--sb-font-display); font-size: var(--sb-font-size-xl); }
</style>`,
    TeamGrid: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Team', body } = Astro.props;
---
<section class="section team">
  <div class="container">
    <h2>{heading}</h2>
    {body && <p class="lede">{body}</p>}
    <div class="grid" aria-hidden="true"><span></span><span></span><span></span></div>
  </div>
</section>
<style>
  .lede { color: var(--sb-ink-muted); }
  .grid { display: grid; gap: var(--sb-space-4); margin-top: var(--sb-space-6); }
  @media (min-width: 768px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  .grid span { min-height: 10rem; border-radius: var(--sb-radius-md); background: var(--sb-atmosphere); }
</style>`,
    FaqAccordion: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'FAQ', body } = Astro.props;
const items = (body ?? '').split(/\\n/).map((s) => s.trim()).filter(Boolean);
---
<section class="section faq">
  <div class="container">
    <h2>{heading}</h2>
    <div class="list">
      {(items.length ? items : ['Question one — short answer', 'Question two — short answer']).map((item) => (
        <details><summary>{item.split('—')[0]?.trim()}</summary><p>{item.split('—')[1]?.trim() || item}</p></details>
      ))}
    </div>
  </div>
</section>
<style>
  .list { display: grid; gap: var(--sb-space-3); margin-top: var(--sb-space-6); }
  details { padding: var(--sb-space-4); border-radius: var(--sb-radius-md); background: var(--sb-surface); border: 1px solid var(--sb-border); }
  summary { cursor: pointer; font-weight: var(--sb-font-weight-medium); }
</style>`,
    CtaBand: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta = 'Get started' } = Astro.props;
---
<section class="section cta-band">
  <div class="container band">
    <div>
      {heading && <h2>{heading}</h2>}
      {body && <p>{body}</p>}
    </div>
    <a class="button" href="#">{cta}</a>
  </div>
</section>
<style>
  .band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sb-space-6); padding: var(--sb-space-8); border-radius: var(--sb-radius-lg); background: var(--sb-color-primary); color: var(--sb-color-primary-contrast); }
  .band h2, .band p { color: inherit; margin: 0; }
  .band .button { background: var(--sb-color-primary-contrast); color: var(--sb-color-primary); }
</style>`,
    ContactForm: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Contact', body, cta = 'Send' } = Astro.props;
---
<section class="section contact">
  <div class="container">
    <h2>{heading}</h2>
    {body && <p class="lede">{body}</p>}
    <form class="form" onsubmit="return false;">
      <label>Name <input name="name" required /></label>
      <label>Email <input type="email" name="email" required /></label>
      <label>Message <textarea name="message" rows="4"></textarea></label>
      <button class="button" type="submit">{cta}</button>
    </form>
  </div>
</section>
<style>
  .lede { color: var(--sb-ink-muted); }
  .form { display: grid; gap: var(--sb-space-3); max-width: 32rem; margin-top: var(--sb-space-6); }
  input, textarea { width: 100%; padding: var(--sb-space-3); border-radius: var(--sb-radius-sm); border: 1px solid var(--sb-border); font: inherit; }
</style>`,
    MapSection: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Find us', body } = Astro.props;
---
<section class="section map">
  <div class="container">
    <h2>{heading}</h2>
    {body && <p>{body}</p>}
    <div class="map-frame" aria-hidden="true"></div>
  </div>
</section>
<style>
  .map-frame { margin-top: var(--sb-space-6); min-height: 16rem; border-radius: var(--sb-radius-md); background: var(--sb-atmosphere); }
</style>`,
    BlogGrid: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Latest', body } = Astro.props;
---
<section class="section blog">
  <div class="container">
    <h2>{heading}</h2>
    {body && <p class="lede">{body}</p>}
    <div class="grid" aria-hidden="true"><article></article><article></article><article></article></div>
  </div>
</section>
<style>
  .lede { color: var(--sb-ink-muted); }
  .grid { display: grid; gap: var(--sb-space-4); margin-top: var(--sb-space-6); }
  @media (min-width: 768px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  article { min-height: 12rem; border-radius: var(--sb-radius-md); background: var(--sb-surface); border: 1px solid var(--sb-border); }
</style>`,
    ContentProse: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body } = Astro.props;
---
<section class="section prose">
  <div class="container narrow">
    {heading && <h2>{heading}</h2>}
    {body && <p>{body}</p>}
  </div>
</section>
<style>
  .narrow { max-width: 42rem; }
</style>`,
    GalleryGrid: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Gallery' } = Astro.props;
---
<section class="section gallery">
  <div class="container">
    <h2>{heading}</h2>
    <div class="grid" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  </div>
</section>
<style>
  .grid { display: grid; gap: var(--sb-space-3); margin-top: var(--sb-space-6); grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 768px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  .grid span { aspect-ratio: 1; border-radius: var(--sb-radius-md); background: var(--sb-atmosphere); }
</style>`,
    SiteFooter: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading = 'Footer', body } = Astro.props;
---
<footer class="section site-footer">
  <div class="container">
    <p class="title">{heading}</p>
    {body && <p class="meta">{body}</p>}
  </div>
</footer>
<style>
  .site-footer { border-top: 1px solid var(--sb-border); padding-block: var(--sb-space-8); }
  .title { font-family: var(--sb-font-display); font-weight: var(--sb-font-weight-bold); margin: 0; }
  .meta { color: var(--sb-ink-muted); margin: var(--sb-space-2) 0 0; }
</style>`,
    GenericSection: `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta } = Astro.props;
---
<section class="section generic">
  <div class="container">
    {heading && <h2>{heading}</h2>}
    {body && <p>{body}</p>}
    {cta && <a class="button" href="#">{cta}</a>}
  </div>
</section>`,
  };

  return (
    layouts[name] ??
    `---
interface Props { heading?: string; body?: string; cta?: string }
const { heading, body, cta } = Astro.props;
---
<section class="section ${slugify(name)}">
  <div class="container">
    {heading && <h2>{heading}</h2>}
    {body && <p>{body}</p>}
    {cta && <a class="button" href="#">{cta}</a>}
  </div>
</section>
`
  );
}

function yamlQuote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

function pageMarkdown(
  page: ExportPage,
  sections: ExportSectionInstance[],
  seo: ExportSeoPage | null,
): string {
  const sectionBlocks = sections.map((section) => {
    const component = sectionComponentName(section);
    const props = sectionProps(section);
    return [
      `  - component: ${component}`,
      `    heading: ${yamlQuote(props.heading)}`,
      `    body: ${yamlQuote(props.body)}`,
      `    cta: ${yamlQuote(props.cta)}`,
    ].join('\n');
  });

  const bodyNotes = [
    `# ${page.title}`,
    '',
    page.description || '_No description._',
    '',
    '## Copy outlines',
    '',
    ...sections.flatMap((section) => [
      `### ${section.sectionType} (\`${section.id}\`)`,
      '',
      section.copyOutline.trim() || '_Empty outline._',
      '',
    ]),
  ].join('\n');

  return [
    '---',
    `title: ${yamlQuote(page.title)}`,
    `seoTitle: ${yamlQuote(seo?.meta.title || page.title)}`,
    `metaDescription: ${yamlQuote(seo?.meta.description || page.description || '')}`,
    `route: ${yamlQuote(pageRoute(page))}`,
    sectionBlocks.length
      ? ['sections:', sectionBlocks.join('\n')].join('\n')
      : 'sections: []',
    '---',
    '',
    bodyNotes,
    '',
  ].join('\n');
}

function pageAstroFile(
  page: ExportPage,
  importPathPrefix: string,
): ExportPackFile {
  const isHome = page.slug === 'home' || page.slug === 'index';
  const path = isHome
    ? 'src/pages/index.astro'
    : `src/pages/${slugify(page.slug)}.astro`;

  const content = `---
import { getEntry, render } from 'astro:content';
import BaseLayout from '${importPathPrefix}layouts/BaseLayout.astro';
import { sectionComponents } from '${importPathPrefix}lib/section-map';
import { jsonLdForPage } from '${importPathPrefix}lib/json-ld';

const entry = await getEntry('pages', '${slugify(page.slug)}');
if (!entry) {
  throw new Error('Missing content collection entry for page "${page.slug}"');
}
const { Content } = await render(entry);
const { seoTitle, metaDescription, sections } = entry.data;
const jsonLd = jsonLdForPage('${page.slug}');
---

<BaseLayout title={seoTitle} description={metaDescription} jsonLd={jsonLd}>
  {sections.map((section) => {
    const Component = sectionComponents[section.component] ?? sectionComponents.GenericSection;
    return (
      <Component
        heading={section.heading}
        body={section.body}
        cta={section.cta}
      />
    );
  })}
  <section class="section">
    <div class="container narrow-notes">
      <details>
        <summary>Editor notes (from content collection)</summary>
        <Content />
      </details>
    </div>
  </section>
</BaseLayout>

<style>
  .narrow-notes { max-width: 42rem; color: var(--sb-ink-muted); font-size: var(--sb-font-size-sm); }
  details { margin-block: var(--sb-space-6); }
</style>
`;

  return { path, content };
}

/**
 * Build a zip-ready Astro starter from SiteStudioExport.
 */
export function generateAstroPack(
  exp: SiteStudioExport,
  options?: SeoGeneratorOptions,
): AstroPack {
  assertCompatibleExportSchemaVersion(exp.schemaVersion);

  const files: ExportPackFile[] = [];
  const slug = projectSlug(exp.website.name);
  const pages =
    exp.sitemap.length > 0
      ? exp.sitemap
      : ([
          {
            slug: 'home',
            title: exp.website.name,
            description: 'Homepage',
            pageType: 'home',
            parentId: null,
            status: 'draft',
            sectionIds: [],
          },
        ] satisfies ExportPage[]);

  const usedComponents = new Set<string>(['GenericSection']);
  for (const page of pages) {
    for (const section of sectionsForPage(page, exp.sections)) {
      usedComponents.add(sectionComponentName(section));
    }
  }

  const { pages: jsonLdPages, siteGraph } = generateJsonLd(exp);
  const jsonLdBySlug: Record<string, unknown[]> = {};
  for (const page of jsonLdPages) {
    jsonLdBySlug[page.pageSlug] = page.blocks;
  }

  files.push({
    path: 'package.json',
    content: `${JSON.stringify(
      {
        name: slug,
        type: 'module',
        version: '0.0.1',
        private: true,
        scripts: {
          dev: 'astro dev',
          build: 'astro build',
          preview: 'astro preview',
        },
        dependencies: {
          astro: '^5.7.10',
        },
      },
      null,
      2,
    )}\n`,
  });

  files.push({
    path: 'astro.config.mjs',
    content: `import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  srcDir: 'src',
});
`,
  });

  files.push({
    path: 'tsconfig.json',
    content: `${JSON.stringify(
      {
        extends: 'astro/tsconfigs/strict',
        include: ['.astro/types.d.ts', '**/*'],
        exclude: ['dist'],
      },
      null,
      2,
    )}\n`,
  });

  files.push({
    path: '.gitignore',
    content: ['node_modules', 'dist', '.astro', '.DS_Store', ''].join('\n'),
  });

  files.push({
    path: 'README.md',
    content: [
      `# ${exp.website.name} — Astro starter`,
      '',
      'Generated by Ozer Site Studio from the **SiteStudioExport** contract.',
      '',
      '## Run',
      '',
      '```bash',
      'pnpm install',
      'pnpm dev',
      '```',
      '',
      'Then open the local URL Astro prints (usually `http://localhost:4321`).',
      '',
      '## What’s inside',
      '',
      '- `src/pages/*` — one route per sitemap page',
      '- `src/components/sections/*` — layout approximations of the Site Studio block library',
      '- `src/content/pages/*.md` — **content collections** seeded from copy outlines (free CMS path)',
      '- `src/styles/tokens.css` — D1 style tokens as `--sb-*` CSS variables',
      '- `public/llms.txt` — llmstxt.org index (brief + sitemap + approved answers)',
      '- `src/lib/json-ld.ts` — JSON-LD entity graph + per-page blocks (injected in `<head>`)',
      '',
      '## CMS note',
      '',
      'Content collections are the default editing surface. A **Decodable** (or other headless CMS) stub is an optional follow-up — it is **not** included in this pack.',
      '',
      `Contract schemaVersion: \`${exp.schemaVersion}\` · Generated: ${exp.generatedAt}`,
      '',
    ].join('\n'),
  });

  files.push({
    path: 'public/llms.txt',
    content: generateLlmsTxt(exp, options),
  });

  files.push({
    path: 'src/lib/json-ld.ts',
    content: `/** Generated JSON-LD from Site Studio (Prompt E2). */

export const siteGraph = ${JSON.stringify(siteGraph, null, 2)} as Record<string, unknown>;

export const jsonLdByPageSlug: Record<string, unknown[]> = ${JSON.stringify(jsonLdBySlug, null, 2)};

export function jsonLdForPage(slug: string): unknown[] {
  return jsonLdByPageSlug[slug] ?? [siteGraph];
}
`,
  });

  files.push({
    path: 'src/styles/tokens.css',
    content: packTokensCss(exp.styleTokens),
  });

  files.push({
    path: 'src/styles/global.css',
    content: `@import './tokens.css';
`,
  });

  files.push({
    path: 'src/layouts/BaseLayout.astro',
    content: `---
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
  jsonLd?: unknown[];
}
const { title, description = '', jsonLd = [] } = Astro.props;
---
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description ? <meta name="description" content={description} /> : null}
    {jsonLd.map((block) => (
      <script type="application/ld+json" set:html={JSON.stringify(block)} />
    ))}
  </head>
  <body>
    <slot />
  </body>
</html>
`,
  });

  files.push({
    path: 'src/content.config.ts',
    content: `import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string(),
    metaDescription: z.string().optional().default(''),
    route: z.string(),
    sections: z.array(
      z.object({
        component: z.string(),
        heading: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
      }),
    ),
  }),
});

export const collections = { pages };
`,
  });

  for (const name of [...usedComponents].sort()) {
    files.push({
      path: `src/components/sections/${name}.astro`,
      content: `${astroSectionComponent(name)}\n`,
    });
  }

  const mapImports = [...usedComponents]
    .sort()
    .map(
      (name) => `import ${name} from '../components/sections/${name}.astro';`,
    )
    .join('\n');

  const mapEntries = [...usedComponents]
    .sort()
    .map((name) => `  ${name},`)
    .join('\n');

  files.push({
    path: 'src/lib/section-map.ts',
    content: `${mapImports}

export const sectionComponents: Record<string, any> = {
${mapEntries}
};
`,
  });

  for (const page of pages) {
    const sections = sectionsForPage(page, exp.sections);
    const seo = seoForPage(exp, page);
    files.push({
      path: `src/content/pages/${slugify(page.slug)}.md`,
      content: pageMarkdown(page, sections, seo),
    });
    files.push(pageAstroFile(page, '../'));
  }

  return { files };
}

export function astroPackZipFilename(websiteName: string): string {
  return `${projectSlug(websiteName)}-astro-starter.zip`;
}
