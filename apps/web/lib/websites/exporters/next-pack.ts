/**
 * Next.js App Router starter pack (Prompt E3).
 *
 * Consumers SiteStudioExport ONLY — never reads the database.
 * Emits a zip-ready Next project: nested app/ routes, site.config.ts,
 * self-contained section components on --sb-* tokens (NO @kit/site-blocks-core),
 * generateMetadata + JSON-LD per page, public/llms.txt.
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

export type NextPack = {
  files: ExportPackFile[];
};

type SectionProps = {
  heading: string;
  body: string;
  cta: string;
};

function seoForPage(
  exp: SiteStudioExport,
  page: ExportPage,
): ExportSeoPage | null {
  return exp.seo?.pages.find((row) => row.pageSlug === page.slug) ?? null;
}

function sectionProps(section: ExportSectionInstance): SectionProps {
  const slots =
    section.props &&
    typeof section.props === 'object' &&
    'slots' in section.props &&
    section.props.slots &&
    typeof section.props.slots === 'object'
      ? (section.props.slots as Record<string, unknown>)
      : {};

  return {
    heading: String(
      slots.headline ??
        slots.heading ??
        firstOutlineLine(section.copyOutline, section.sectionType),
    ),
    body: String(
      slots.subheadline ??
        slots.body ??
        (section.copyOutline.trim() ||
          firstOutlineLine(section.copyOutline, section.sectionType)),
    ),
    cta: String(slots.cta ?? slots.primaryCta ?? 'Learn more'),
  };
}

/**
 * Resolve parentSlug from ExportPage.parentId.
 * Contract currently stores source sitemap ids (e.g. `page-home`); also accept
 * direct slug references for forward-compat.
 */
function resolveParentSlug(
  page: ExportPage,
  pages: ExportPage[],
): string | null {
  if (!page.parentId) return null;

  const direct = pages.find((item) => item.slug === page.parentId);
  if (direct) return direct.slug;

  const stripped = page.parentId.replace(/^page[-_]/i, '');
  const byStrip = pages.find((item) => item.slug === stripped);
  if (byStrip) return byStrip.slug;

  return null;
}

/** App Router segments from root → leaf (home/index omitted). */
function routeSegments(page: ExportPage, pages: ExportPage[]): string[] {
  const chain: ExportPage[] = [];
  let current: ExportPage | null = page;
  const guard = new Set<string>();

  while (current) {
    if (guard.has(current.slug)) break;
    guard.add(current.slug);
    chain.unshift(current);
    const parentSlug = resolveParentSlug(current, pages);
    current = parentSlug
      ? (pages.find((item) => item.slug === parentSlug) ?? null)
      : null;
  }

  return chain
    .filter((item) => item.slug !== 'home' && item.slug !== 'index')
    .map((item) => slugify(item.slug));
}

function pageTsxPath(segments: string[]): string {
  if (segments.length === 0) return 'app/page.tsx';
  return `app/${segments.join('/')}/page.tsx`;
}

function relativeImportDepth(segments: string[]): string {
  // app/page.tsx → ../ ; app/a/b/page.tsx → ../../../
  const ups = segments.length + 1;
  return `${'../'.repeat(ups)}`;
}

function needsCmsStub(exp: SiteStudioExport): boolean {
  const stack = exp.brief?.stackPreference ?? exp.website.stackPreference;
  return stack === 'webflow' || stack === 'ozer_sites';
}

function nextSectionComponent(name: string): string {
  const layouts: Record<string, string> = {
    SiteNav: `export function SiteNav({
  heading = 'Site',
  cta = 'Contact',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <header className="section site-nav">
      <div className="container nav-row">
        <a className="logo" href="/">
          {heading}
        </a>
        <a className="button" href="#contact">
          {cta}
        </a>
      </div>
    </header>
  );
}
`,
    HeroSplit: `export function HeroSplit({
  heading,
  body,
  cta,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section hero-split">
      <div className="container split">
        <div>
          {heading ? <h1>{heading}</h1> : null}
          {body ? <p className="lede">{body}</p> : null}
          {cta ? (
            <a className="button" href="#cta">
              {cta}
            </a>
          ) : null}
        </div>
        <div className="media" aria-hidden="true" />
      </div>
    </section>
  );
}
`,
    HeroCentered: `export function HeroCentered({
  heading,
  body,
  cta,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section hero-centered">
      <div className="container center">
        {heading ? <h1>{heading}</h1> : null}
        {body ? <p className="lede">{body}</p> : null}
        {cta ? (
          <a className="button" href="#cta">
            {cta}
          </a>
        ) : null}
      </div>
    </section>
  );
}
`,
    HeroForm: `export function HeroForm({
  heading,
  body,
  cta = 'Submit',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section hero-form">
      <div className="container split">
        <div>
          {heading ? <h1>{heading}</h1> : null}
          {body ? <p className="lede">{body}</p> : null}
        </div>
        <form className="card" action="#" method="post">
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <button className="button" type="submit">
            {cta}
          </button>
        </form>
      </div>
    </section>
  );
}
`,
    FeatureGrid: `export function FeatureGrid({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  const items = (body ?? '')
    .split(/\\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  const cards = items.length ? items : ['Item one', 'Item two', 'Item three'];

  return (
    <section className="section feature-grid">
      <div className="container">
        {heading ? <h2>{heading}</h2> : null}
        <div className="grid-3">
          {cards.map((item) => (
            <article key={item} className="card">
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
    FeatureAlternating: `export function FeatureAlternating({
  heading,
  body,
  cta,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section feature-alt">
      <div className="container split">
        <div className="media" aria-hidden="true" />
        <div>
          {heading ? <h2>{heading}</h2> : null}
          {body ? <p>{body}</p> : null}
          {cta ? (
            <a className="button" href="#cta">
              {cta}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
`,
    LogoCloud: `export function LogoCloud({
  heading = 'Trusted by',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section logo-cloud">
      <div className="container">
        <p className="eyebrow">{heading}</p>
        <div className="logo-row" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
`,
    Testimonials: `export function Testimonials({
  heading = 'What people say',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section testimonials">
      <div className="container">
        <h2>{heading}</h2>
        <blockquote>
          <p>{body || 'A short testimonial goes here.'}</p>
        </blockquote>
      </div>
    </section>
  );
}
`,
    StatsBar: `export function StatsBar({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  const stats = (body ?? '100+|Projects;50+|Years;1k+|People')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <section className="section stats-bar">
      <div className="container grid-3 center-text">
        {stats.map((stat) => {
          const [value, label] = stat.split('|');
          return (
            <div key={stat}>
              <p className="stat-value">{value}</p>
              <p className="stat-label">{label || heading || 'Stat'}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
`,
    PricingTable: `export function PricingTable({
  heading = 'Pricing',
  body,
  cta = 'Get started',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section pricing">
      <div className="container">
        <h2>{heading}</h2>
        {body ? <p className="lede">{body}</p> : null}
        <div className="card pricing-card">
          <p className="stat-value">Custom</p>
          <a className="button" href="#cta">
            {cta}
          </a>
        </div>
      </div>
    </section>
  );
}
`,
    TeamGrid: `export function TeamGrid({
  heading = 'Team',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section team">
      <div className="container">
        <h2>{heading}</h2>
        {body ? <p className="lede">{body}</p> : null}
        <div className="grid-3" aria-hidden="true">
          <span className="media" />
          <span className="media" />
          <span className="media" />
        </div>
      </div>
    </section>
  );
}
`,
    FaqAccordion: `export function FaqAccordion({
  heading = 'FAQ',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  const items = (body ?? '')
    .split(/\\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rows = items.length
    ? items
    : ['Question one — short answer', 'Question two — short answer'];

  return (
    <section className="section faq">
      <div className="container">
        <h2>{heading}</h2>
        <div className="faq-list">
          {rows.map((item) => {
            const [q, a] = item.split('—');
            return (
              <details key={item} className="card">
                <summary>{(q ?? item).trim()}</summary>
                <p>{(a ?? item).trim()}</p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`,
    CtaBand: `export function CtaBand({
  heading,
  body,
  cta = 'Get started',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section cta-band">
      <div className="container band">
        <div>
          {heading ? <h2>{heading}</h2> : null}
          {body ? <p>{body}</p> : null}
        </div>
        <a className="button button-invert" href="#cta">
          {cta}
        </a>
      </div>
    </section>
  );
}
`,
    ContactForm: `export function ContactForm({
  heading = 'Contact',
  body,
  cta = 'Send',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section id="contact" className="section contact">
      <div className="container">
        <h2>{heading}</h2>
        {body ? <p className="lede">{body}</p> : null}
        <form className="form" action="#" method="post">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Message
            <textarea name="message" rows={4} />
          </label>
          <button className="button" type="submit">
            {cta}
          </button>
        </form>
      </div>
    </section>
  );
}
`,
    MapSection: `export function MapSection({
  heading = 'Find us',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section map">
      <div className="container">
        <h2>{heading}</h2>
        {body ? <p>{body}</p> : null}
        <div className="media map-frame" aria-hidden="true" />
      </div>
    </section>
  );
}
`,
    BlogGrid: `export function BlogGrid({
  heading = 'Latest',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section blog">
      <div className="container">
        <h2>{heading}</h2>
        {body ? <p className="lede">{body}</p> : null}
        <div className="grid-3" aria-hidden="true">
          <article className="card tall" />
          <article className="card tall" />
          <article className="card tall" />
        </div>
      </div>
    </section>
  );
}
`,
    ContentProse: `export function ContentProse({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section prose">
      <div className="container narrow">
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p>{body}</p> : null}
      </div>
    </section>
  );
}
`,
    GalleryGrid: `export function GalleryGrid({
  heading = 'Gallery',
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section gallery">
      <div className="container">
        <h2>{heading}</h2>
        <div className="gallery-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
`,
    SiteFooter: `export function SiteFooter({
  heading = 'Footer',
  body,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <footer className="section site-footer">
      <div className="container">
        <p className="footer-title">{heading}</p>
        {body ? <p className="lede">{body}</p> : null}
      </div>
    </footer>
  );
}
`,
    GenericSection: `export function GenericSection({
  heading,
  body,
  cta,
}: {
  heading?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <section className="section">
      <div className="container">
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p className="lede">{body}</p> : null}
        {cta ? (
          <a className="button" href="#cta">
            {cta}
          </a>
        ) : null}
      </div>
    </section>
  );
}
`,
  };

  return layouts[name] ?? layouts.GenericSection!;
}

function globalsCss(): string {
  return `@import './tokens.css';

:root {
  color-scheme: light;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

img,
svg {
  max-width: 100%;
  display: block;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sb-space-4);
}

.site-nav {
  padding-block: var(--sb-space-4);
  border-bottom: 1px solid var(--sb-border);
}

.logo {
  font-family: var(--sb-font-display);
  font-weight: var(--sb-font-weight-bold);
  color: var(--sb-ink);
  text-decoration: none;
}

.split {
  display: grid;
  gap: var(--sb-space-8);
  align-items: center;
}

@media (min-width: 768px) {
  .split {
    grid-template-columns: 1.1fr 0.9fr;
  }
}

.center {
  text-align: center;
  max-width: 48rem;
  margin-inline: auto;
}

.center-text {
  text-align: center;
}

.lede {
  color: var(--sb-ink-muted);
  max-width: 36rem;
}

.media {
  min-height: 12rem;
  border-radius: var(--sb-radius-lg);
  background: var(--sb-atmosphere);
}

.card {
  padding: var(--sb-space-6);
  border-radius: var(--sb-radius-md);
  background: var(--sb-surface);
  border: 1px solid var(--sb-border);
}

.grid-3 {
  display: grid;
  gap: var(--sb-space-4);
  margin-top: var(--sb-space-6);
}

@media (min-width: 768px) {
  .grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: var(--sb-font-size-sm);
  color: var(--sb-ink-muted);
}

.logo-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sb-space-4);
  margin-top: var(--sb-space-4);
}

.logo-row span {
  height: 2.5rem;
  border-radius: var(--sb-radius-sm);
  background: var(--sb-atmosphere);
}

blockquote {
  margin: var(--sb-space-6) 0 0;
  padding: var(--sb-space-6);
  border-radius: var(--sb-radius-md);
  background: var(--sb-surface);
  border-left: 4px solid var(--sb-color-primary);
}

.stat-value {
  font-family: var(--sb-font-display);
  font-size: var(--sb-font-size-2xl);
  margin: 0;
}

.stat-label {
  color: var(--sb-ink-muted);
  margin: var(--sb-space-2) 0 0;
}

.pricing-card {
  margin-top: var(--sb-space-6);
  max-width: 24rem;
}

.faq-list {
  display: grid;
  gap: var(--sb-space-3);
  margin-top: var(--sb-space-6);
}

.faq-list summary {
  cursor: pointer;
  font-weight: var(--sb-font-weight-medium);
}

.band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sb-space-6);
  padding: var(--sb-space-8);
  border-radius: var(--sb-radius-lg);
  background: var(--sb-color-primary);
  color: var(--sb-color-primary-contrast);
}

.band h2,
.band p {
  color: inherit;
  margin: 0;
}

.button-invert {
  background: var(--sb-color-primary-contrast);
  color: var(--sb-color-primary);
}

.form {
  display: grid;
  gap: var(--sb-space-3);
  max-width: 32rem;
  margin-top: var(--sb-space-6);
}

.form input,
.form textarea,
.card input {
  width: 100%;
  padding: var(--sb-space-3);
  border-radius: var(--sb-radius-sm);
  border: 1px solid var(--sb-border);
  font: inherit;
}

.map-frame {
  margin-top: var(--sb-space-6);
  min-height: 16rem;
}

.tall {
  min-height: 12rem;
}

.narrow {
  max-width: 42rem;
}

.gallery-grid {
  display: grid;
  gap: var(--sb-space-3);
  margin-top: var(--sb-space-6);
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.gallery-grid span {
  aspect-ratio: 1;
  border-radius: var(--sb-radius-md);
  background: var(--sb-atmosphere);
}

.site-footer {
  border-top: 1px solid var(--sb-border);
  padding-block: var(--sb-space-8);
}

.footer-title {
  font-family: var(--sb-font-display);
  font-weight: var(--sb-font-weight-bold);
  margin: 0;
}
`;
}

function buildSiteConfig(exp: SiteStudioExport, pages: ExportPage[]): string {
  const pageConfigs = pages.map((page) => {
    const seo = seoForPage(exp, page);
    const approved = seo?.status === 'approved';
    const sections = sectionsForPage(page, exp.sections).map((section) => {
      const props = sectionProps(section);
      return {
        id: section.id,
        component: sectionComponentName(section),
        heading: props.heading,
        body: props.body,
        cta: props.cta,
      };
    });

    const parentSlug = resolveParentSlug(page, pages);
    const segments = routeSegments(page, pages);
    const route = segments.length === 0 ? '/' : `/${segments.join('/')}`;

    return {
      slug: page.slug,
      route,
      title: page.title,
      description: page.description,
      parentSlug:
        parentSlug && parentSlug !== 'home' && parentSlug !== 'index'
          ? parentSlug
          : parentSlug === 'home' || parentSlug === 'index'
            ? 'home'
            : null,
      status: page.status,
      seo: seo
        ? {
            title: approved ? seo.meta.title || page.title : page.title,
            description: approved
              ? seo.meta.description || page.description
              : page.description,
            indexable: seo.technical.indexable,
            approved,
            primaryKeyword: seo.keywords.primary,
          }
        : null,
      sections,
    };
  });

  return `/**
 * Typed site content generated from SiteStudioExport.
 * Edit this file in git — no CMS required unless a stub is included.
 */

export type SiteSection = {
  id: string;
  component: string;
  heading: string;
  body: string;
  cta: string;
};

export type SitePageSeo = {
  title: string;
  description: string;
  indexable: boolean;
  approved: boolean;
  primaryKeyword: string;
};

export type SitePage = {
  slug: string;
  route: string;
  title: string;
  description: string;
  parentSlug: string | null;
  status: string;
  seo: SitePageSeo | null;
  sections: SiteSection[];
};

export const site = {
  name: ${JSON.stringify(exp.website.name)},
  domain: ${JSON.stringify(exp.website.domain ?? null)},
  stackPreference: ${JSON.stringify(
    exp.brief?.stackPreference ?? exp.website.stackPreference,
  )},
  orgName: ${JSON.stringify(exp.brief?.org.name || exp.website.name)},
  oneLiner: ${JSON.stringify(exp.brief?.org.oneLiner || '')},
  schemaVersion: ${JSON.stringify(exp.schemaVersion)},
  generatedAt: ${JSON.stringify(exp.generatedAt)},
  pages: ${JSON.stringify(pageConfigs, null, 2)} as SitePage[],
};

export function getPage(slug: string): SitePage | undefined {
  return site.pages.find((page) => page.slug === slug);
}
`;
}

function pageModule(
  page: ExportPage,
  pages: ExportPage[],
): { path: string; content: string } {
  const segments = routeSegments(page, pages);
  const rel = relativeImportDepth(segments);
  const path = pageTsxPath(segments);

  const content = `import type { Metadata } from 'next';

import { JsonLd } from '${rel}components/JsonLd';
import { PageSections } from '${rel}components/PageSections';
import { jsonLdForPage } from '${rel}lib/site-json-ld';
import { getPage } from '${rel}site.config';

const pageOrNull = getPage(${JSON.stringify(page.slug)});

if (!pageOrNull) {
  throw new Error('Missing site.config entry for slug ${JSON.stringify(page.slug)}');
}

const page = pageOrNull;

export function generateMetadata(): Metadata {
  const title = page.seo?.approved
    ? page.seo.title
    : page.title;
  const description = page.seo?.approved
    ? page.seo.description
    : page.description;

  return {
    title,
    description,
    robots: page.seo?.indexable === false ? { index: false, follow: false } : undefined,
  };
}

export default function Page() {
  return (
    <>
      <JsonLd data={jsonLdForPage(page.slug)} />
      <main>
        <PageSections sections={page.sections} />
      </main>
    </>
  );
}
`;

  return { path, content };
}

function readme(exp: SiteStudioExport, cms: boolean): string {
  const name = exp.website.name;
  const lines = [
    `# ${name} — Next.js App Router starter`,
    '',
    'Generated by Ozer Site Studio from the **SiteStudioExport** contract.',
    'This repo is self-contained — it does **not** depend on `@kit/site-blocks-core`.',
    '',
    '## Run locally',
    '',
    '```bash',
    'pnpm install',
    'pnpm dev',
    '```',
    '',
    'Open the URL Next prints (usually `http://localhost:3000`).',
    '',
    '```bash',
    'pnpm build && pnpm start',
    '```',
    '',
    '## Deploy to Vercel',
    '',
    '1. Push this folder to a Git repo (or `vercel` from the CLI).',
    '2. Import the project in Vercel — Framework Preset: **Next.js**.',
    '3. Build command `pnpm build` · Output uses Next defaults (no extra config).',
    '4. Add your production domain; `llms.txt` is served from `public/llms.txt`.',
    '',
    '## Content model',
    '',
  ];

  if (cms) {
    lines.push(
      `Brief stack preference is **${exp.brief?.stackPreference ?? exp.website.stackPreference}**, which implies editors outside git.`,
      'A CMS stub lives in `content/cms.stub.md` — wire Payload, Sanity, or Webflow CMS when ready.',
      'Until then, **`site.config.ts` remains the live content source** so `pnpm dev` works offline.',
      '',
    );
  } else {
    lines.push(
      '**Pure typed config** — edit `site.config.ts` in git. No CMS is included because',
      `stack preference is \`${exp.brief?.stackPreference ?? exp.website.stackPreference}\` (not Webflow / Ozer Sites).`,
      '',
    );
  }

  lines.push(
    '## Where things came from',
    '',
    '| Path | Source |',
    '| --- | --- |',
    '| `site.config.ts` | Sitemap pages, section copy outlines, approved SEO meta |',
    '| `app/**/page.tsx` | Sitemap tree (`parentId` → nested folders; home → `app/page.tsx`) |',
    '| `components/sections/*` | Block layouts used in the export (self-contained React + CSS vars) |',
    '| `app/tokens.css` | Site Studio D1 style tokens (`--sb-*`) |',
    '| `lib/site-json-ld.ts` | E2 JSON-LD generators (stable `@id` entity graph) |',
    '| `public/llms.txt` | E2 llms.txt (brief + sitemap + approved answer blocks) |',
    '| `generateMetadata` | Approved SEO title/description per page (falls back to sitemap when draft) |',
    '',
    '## Notes',
    '',
    '- Section components consume CSS variables only — safe to restyle via `tokens.css`.',
    '- JSON-LD is injected per page via `<JsonLd />` in the page body (valid for crawlers).',
    '- Prefer semantic landmarks (`header` / `main` / `footer`) already present in sections.',
    '',
    `Contract schemaVersion: \`${exp.schemaVersion}\` · Generated: ${exp.generatedAt}`,
    '',
  );

  return lines.join('\n');
}

/**
 * Build a zip-ready Next.js App Router starter from SiteStudioExport.
 */
export function generateNextPack(
  exp: SiteStudioExport,
  options?: SeoGeneratorOptions,
): NextPack {
  assertCompatibleExportSchemaVersion(exp.schemaVersion);

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

  const slug = projectSlug(exp.website.name);
  const cms = needsCmsStub(exp);
  const files: ExportPackFile[] = [];

  files.push({
    path: 'package.json',
    content: `${JSON.stringify(
      {
        name: slug,
        version: '0.0.1',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          next: '^15.3.3',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@types/node': '^22.15.21',
          '@types/react': '^19.1.5',
          '@types/react-dom': '^19.1.5',
          typescript: '^5.8.3',
        },
      },
      null,
      2,
    )}\n`,
  });

  files.push({
    path: 'tsconfig.json',
    content: `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./*'] },
        },
        include: [
          'next-env.d.ts',
          '**/*.ts',
          '**/*.tsx',
          '.next/types/**/*.ts',
        ],
        exclude: ['node_modules'],
      },
      null,
      2,
    )}\n`,
  });

  files.push({
    path: 'next.config.ts',
    content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,
  });

  files.push({
    path: 'next-env.d.ts',
    content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited — see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
  });

  files.push({
    path: '.gitignore',
    content: ['node_modules', '.next', 'out', '.DS_Store', '*.log', ''].join(
      '\n',
    ),
  });

  files.push({
    path: 'README.md',
    content: readme(exp, cms),
  });

  files.push({
    path: 'site.config.ts',
    content: buildSiteConfig(exp, pages),
  });

  files.push({
    path: 'app/tokens.css',
    content: packTokensCss(exp.styleTokens),
  });

  files.push({
    path: 'app/globals.css',
    content: globalsCss(),
  });

  files.push({
    path: 'app/layout.tsx',
    content: `import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { site } from '../site.config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: \`%s · \${site.name}\`,
  },
  description: site.oneLiner || site.name,
  metadataBase: site.domain
    ? new URL(
        site.domain.startsWith('http')
          ? site.domain
          : \`https://\${site.domain}\`,
      )
    : undefined,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
`,
  });

  files.push({
    path: 'public/llms.txt',
    content: generateLlmsTxt(exp, options),
  });

  files.push({
    path: 'lib/site-json-ld.ts',
    content: `/** Generated JSON-LD from Site Studio (Prompt E2/E3). Stable @ids across pages. */

export const siteGraph = ${JSON.stringify(siteGraph, null, 2)} as Record<string, unknown>;

export const jsonLdByPageSlug: Record<string, unknown[]> = ${JSON.stringify(jsonLdBySlug, null, 2)};

export function jsonLdForPage(slug: string): unknown[] {
  return jsonLdByPageSlug[slug] ?? [siteGraph];
}
`,
  });

  files.push({
    path: 'components/JsonLd.tsx',
    content: `/** Render JSON-LD script tags for crawlers. */

function serialiseJsonLd(block: unknown): string {
  // Escape < / > so user content cannot break out of the script tag.
  return JSON.stringify(block)
    .replace(/</g, '\\\\u003c')
    .replace(/>/g, '\\\\u003e');
}

export function JsonLd({ data }: { data: unknown | unknown[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(block) }}
        />
      ))}
    </>
  );
}
`,
  });

  const sectionImports = [...usedComponents]
    .sort()
    .map((name) => `import { ${name} } from './sections/${name}';`)
    .join('\n');

  const sectionMap = [...usedComponents]
    .sort()
    .map((name) => `  ${name},`)
    .join('\n');

  files.push({
    path: 'components/PageSections.tsx',
    content: `import type { ComponentType } from 'react';

import type { SiteSection } from '../site.config';
${sectionImports}

type SectionProps = { heading?: string; body?: string; cta?: string };

const registry: Record<string, ComponentType<SectionProps>> = {
${sectionMap}
};

export function PageSections({ sections }: { sections: SiteSection[] }) {
  return (
    <>
      {sections.map((section) => {
        const Component =
          registry[section.component] ?? registry.GenericSection!;
        return (
          <Component
            key={section.id}
            heading={section.heading}
            body={section.body}
            cta={section.cta}
          />
        );
      })}
    </>
  );
}
`,
  });

  for (const name of [...usedComponents].sort()) {
    files.push({
      path: `components/sections/${name}.tsx`,
      content: `${nextSectionComponent(name)}\n`,
    });
  }

  for (const page of pages) {
    files.push(pageModule(page, pages));
  }

  if (cms) {
    files.push({
      path: 'content/cms.stub.md',
      content: [
        '# CMS stub (optional)',
        '',
        `Stack preference **${exp.brief?.stackPreference ?? exp.website.stackPreference}** implies editors outside git.`,
        '',
        'Suggested follow-up:',
        '',
        '1. Keep `site.config.ts` as the compile-time fallback.',
        '2. Add Payload, Sanity, or Webflow CMS and map entries → `SitePage`.',
        '3. Replace `getPage()` reads with CMS fetches in each `app/**/page.tsx`.',
        '',
        'Do not block launch on CMS — typed config is enough for `pnpm install && pnpm dev`.',
        '',
      ].join('\n'),
    });
  }

  return { files };
}

export function nextPackZipFilename(websiteName: string): string {
  return `${projectSlug(websiteName)}-next-starter.zip`;
}
