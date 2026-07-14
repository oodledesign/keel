import type {
  ExportPage,
  ExportSectionInstance,
  StyleTokens,
} from '../export-contract';
import { styleTokensRootCss } from '../export/tokens-css';
import { findSectionLibraryEntry } from '../section-library';
import { emptyWebsiteStyleTokens } from '../style-tokens';

export type ExportPackFile = {
  path: string;
  /** UTF-8 text or raw binary (e.g. PNG screenshots). */
  content: string | Uint8Array;
};

export function pageRoute(page: ExportPage): string {
  return page.slug === 'home' || page.slug === 'index' ? '/' : `/${page.slug}`;
}

export function slugify(value: string, fallback = 'item'): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

/** Client-First section_[name] stem from layoutPreset / componentKey. */
export function clientFirstSectionName(section: ExportSectionInstance): string {
  const fromLibrary = findSectionLibraryEntry(
    section.componentKey ?? section.layoutPreset,
  );
  if (fromLibrary?.clientFirstName) return fromLibrary.clientFirstName;

  const raw =
    section.componentKey || section.layoutPreset || section.sectionType;
  return slugify(raw.replace(/^site-/, ''), 'section').replace(/-/g, '_');
}

/** PascalCase Astro component name for a section. */
export function sectionComponentName(section: ExportSectionInstance): string {
  const preset = section.layoutPreset || section.sectionType || 'generic';
  const mapped =
    PRESET_TO_COMPONENT[preset] ?? PRESET_TO_COMPONENT[section.sectionType];
  if (mapped) return mapped;

  return (
    preset
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') || 'GenericSection'
  );
}

const PRESET_TO_COMPONENT: Record<string, string> = {
  header: 'SiteNav',
  nav: 'SiteNav',
  'nav-standard': 'SiteNav',
  'hero-split': 'HeroSplit',
  split: 'HeroSplit',
  'hero-centered': 'HeroCentered',
  'hero-center': 'HeroCentered',
  'hero-form': 'HeroForm',
  hero: 'HeroSplit',
  'logo-cloud': 'LogoCloud',
  'feature-grid': 'FeatureGrid',
  'features-grid': 'FeatureGrid',
  'feature-alternating': 'FeatureAlternating',
  testimonials: 'Testimonials',
  'stats-bar': 'StatsBar',
  'pricing-table': 'PricingTable',
  'team-grid': 'TeamGrid',
  'faq-accordion': 'FaqAccordion',
  'cta-band': 'CtaBand',
  'contact-form': 'ContactForm',
  'map-section': 'MapSection',
  'blog-grid': 'BlogGrid',
  'content-prose': 'ContentProse',
  'gallery-grid': 'GalleryGrid',
  footer: 'SiteFooter',
  cards: 'FeatureGrid',
  content: 'ContentProse',
  proof: 'Testimonials',
};

export function resolvePackTokens(tokens: StyleTokens | null): StyleTokens {
  return tokens ?? emptyWebsiteStyleTokens();
}

export function packTokensCss(tokens: StyleTokens | null): string {
  const resolved = resolvePackTokens(tokens);
  return `${styleTokensRootCss(resolved)}
html {
  font-size: ${resolved.typography.typeScale.base}px;
}

body {
  margin: 0;
  background: var(--sb-canvas);
  color: var(--sb-ink);
  font-family: var(--sb-font-body);
  font-weight: var(--sb-font-weight-regular);
  line-height: 1.6;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--sb-font-display);
  font-weight: var(--sb-font-weight-bold);
  line-height: 1.2;
  color: var(--sb-ink);
}

a {
  color: var(--sb-color-primary);
}

.button,
.sb-button {
  display: inline-block;
  padding: var(--sb-space-3) var(--sb-space-6);
  border-radius: var(--sb-button-radius);
  background: var(--sb-color-primary);
  color: var(--sb-color-primary-contrast);
  font-weight: var(--sb-font-weight-medium);
  text-decoration: none;
}

.container {
  width: min(72rem, calc(100% - 2 * var(--sb-space-6)));
  margin-inline: auto;
}

.section {
  padding-block: var(--sb-space-12);
}
`;
}

export function projectSlug(name: string): string {
  return slugify(name, 'site-studio-export');
}

export function sectionsForPage(
  page: ExportPage,
  allSections: ExportSectionInstance[],
): ExportSectionInstance[] {
  return page.sectionIds
    .map((id) => allSections.find((section) => section.id === id))
    .filter((section): section is ExportSectionInstance => Boolean(section));
}

export function copyOutlineLines(outline: string): string[] {
  return outline
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstOutlineLine(outline: string, fallback: string): string {
  return copyOutlineLines(outline)[0] ?? fallback;
}
