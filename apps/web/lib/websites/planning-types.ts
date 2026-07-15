import {
  type WebsiteBrief,
  type WebsiteBriefAiProvenance,
  emptyBriefAiProvenance,
} from './brief-types';
import type { WebsiteSeoPageRecord } from './seo-types';
import type { WebsiteStyleSystem } from './style-tokens';

export type WebsitePlanningTab =
  | 'overview'
  | 'brief'
  | 'sitemap'
  | 'wireframe'
  | 'design'
  | 'seo'
  | 'site'
  | 'export'
  | 'build'
  | 'content';

export const CORE_PLANNING_TABS: WebsitePlanningTab[] = [
  'overview',
  'sitemap',
  'wireframe',
  'content',
];

export const SITE_STUDIO_PLANNING_TABS: WebsitePlanningTab[] = [
  'overview',
  'brief',
  'sitemap',
  'wireframe',
  'design',
  'seo',
  'site',
  'export',
  'build',
  'content',
];

/** Colour-coding by section job (Relume-style). */
export type WebsiteSectionType =
  | 'nav'
  | 'hero'
  | 'proof'
  | 'conversion'
  | 'content'
  | 'footer'
  | 'other';

export type WebsitePlanningStatus = 'draft' | 'approved' | 'blocked';

export type WebsitePageType =
  | 'home'
  | 'service'
  | 'location'
  | 'about'
  | 'contact'
  | 'blog-index'
  | 'blog-post'
  | 'legal'
  | 'landing'
  | 'other';

export type WebsiteSitemapSection = {
  id: string;
  title: string;
  description: string;
  /**
   * Relume-style colour tag (nav/hero/proof…). Canonical colour field (C1).
   * Prefer this over sectionType going forward.
   */
  color?: WebsiteSectionType;
  /**
   * @deprecated Prefer `color`. Kept in sync by migrateSitemapDocument for
   * portal + older clients.
   */
  sectionType?: WebsiteSectionType;
  /** Repeating component symbol key — instances share edits via components[]. */
  componentKey?: string | null;
  status?: WebsitePlanningStatus;
};

export type WebsiteSitemapPage = {
  id: string;
  title: string;
  slug: string;
  sections: WebsiteSitemapSection[];
  /** Site Studio canvas/planning fields (all optional for back-compat). */
  description?: string;
  pageType?: WebsitePageType;
  status?: WebsitePlanningStatus;
  /** Parent page id for nesting (null/undefined = top level). */
  parentId?: string | null;
  /** Canvas position (React Flow). */
  x?: number;
  y?: number;
  /** One-line search intent for this page. */
  seoIntent?: string;
  /** Client approval note (set from portal / public share). */
  approvalNote?: string;
};

/** Shared symbol definition stored once in the sitemap document. */
export type WebsiteSitemapSymbol = {
  key: string;
  title: string;
  description: string;
  color: WebsiteSectionType;
  status: WebsitePlanningStatus;
};

export const WEBSITE_SITEMAP_SCHEMA_VERSION = '1.0' as const;

/**
 * Root sitemap JSONB document (Prompt C1). Legacy storage was a bare page array;
 * migrateSitemapDocument upgrades on read.
 */
export type WebsiteSitemapDocument = {
  schemaVersion: typeof WEBSITE_SITEMAP_SCHEMA_VERSION;
  pages: WebsiteSitemapPage[];
  components: WebsiteSitemapSymbol[];
};

export type WebsiteWireframeLayout =
  | 'full'
  | 'split'
  | 'grid'
  | 'cards'
  | 'cta'
  | 'footer';

/**
 * Site Studio C3 layout presets — map 1:1 to @kit/site-blocks-core blocks.
 * Prefer this over coarse WebsiteWireframeLayout when set.
 */
export type WebsiteLayoutPreset =
  | 'header'
  | 'hero-split'
  | 'hero-centered'
  | 'hero-form'
  | 'logo-cloud'
  | 'feature-grid'
  | 'feature-alternating'
  | 'testimonials'
  | 'stats-bar'
  | 'pricing-table'
  | 'team-grid'
  | 'faq-accordion'
  | 'cta-band'
  | 'contact-form'
  | 'map-section'
  | 'blog-grid'
  | 'content-prose'
  | 'gallery-grid'
  | 'footer';

export const WEBSITE_LAYOUT_PRESET_OPTIONS: Array<{
  value: WebsiteLayoutPreset;
  label: string;
}> = [
  { value: 'header', label: 'Header' },
  { value: 'hero-split', label: 'Hero — split' },
  { value: 'hero-centered', label: 'Hero — centered' },
  { value: 'hero-form', label: 'Hero — with form' },
  { value: 'logo-cloud', label: 'Logo cloud' },
  { value: 'feature-grid', label: 'Feature grid' },
  { value: 'feature-alternating', label: 'Feature — alternating' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'stats-bar', label: 'Stats bar' },
  { value: 'pricing-table', label: 'Pricing table' },
  { value: 'team-grid', label: 'Team grid' },
  { value: 'faq-accordion', label: 'FAQ accordion' },
  { value: 'cta-band', label: 'CTA band' },
  { value: 'contact-form', label: 'Contact form' },
  { value: 'map-section', label: 'Map / locations' },
  { value: 'blog-grid', label: 'Blog grid' },
  { value: 'content-prose', label: 'Content prose' },
  { value: 'gallery-grid', label: 'Gallery grid' },
  { value: 'footer', label: 'Footer' },
];

export type WebsiteWireframeSection = {
  id: string;
  sitemapSectionId: string | null;
  title: string;
  layout: WebsiteWireframeLayout;
  contentNotes: string;
  /** Site Studio: section library variant key (see section-library.ts). */
  libraryKey?: string | null;
  /**
   * Site Studio C3: preferred block identity (hero-split, faq-accordion…).
   * When set, drives Puck Render over coarse `layout`.
   */
  layoutPreset?: WebsiteLayoutPreset | null;
  /** Site Studio: AI-suggested copy outline (client-friendly). */
  copyOutline?: string;
  /**
   * Site Studio: structured Relume-style copy for in-place wireframe editing.
   * `slots` = named fields (headline, cta…); `items` = repeating cards/rows.
   */
  copy?: WebsiteWireframeCopy;
  /** Client feedback left from portal / public share. */
  clientComment?: string;
};

/** Structured copy bound to a library section preview. */
export type WebsiteWireframeCopy = {
  slots: Record<string, string>;
  items?: WebsiteWireframeCopyItem[];
};

export type WebsiteWireframeCopyItem = {
  id: string;
  slots: Record<string, string>;
};

export type WebsiteWireframePage = {
  id: string;
  pageId: string;
  title: string;
  sections: WebsiteWireframeSection[];
};

/**
 * Strip internal-only contentNotes for client-facing portal / public share
 * payloads. Keeps copyOutline + structured copy (shareable).
 */
export function wireframesForClientShare(
  pages: WebsiteWireframePage[],
): WebsiteWireframePage[] {
  return pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      contentNotes: '',
    })),
  }));
}

export type WebsiteContentDoc = {
  id: string;
  title: string;
  contentMd: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Site Studio: brief — re-export A2 model                             */
/* ------------------------------------------------------------------ */

export type {
  WebsiteBrief,
  WebsiteBriefReference,
  WebsiteBriefAiProvenance,
  WebsiteBriefStackPreference,
  BriefAiSource,
  BriefFieldPath,
  BriefSectionKey,
} from './brief-types';
export {
  WEBSITE_BRIEF_SCHEMA_VERSION,
  emptyWebsiteBrief,
  emptyBriefAiProvenance,
  normalizeWebsiteBrief,
  normalizeBriefAiProvenance,
  briefContextText,
  BRIEF_SECTIONS,
  sectionCompleteness,
  overallBriefCompleteness,
} from './brief-types';

/** @deprecated Prefer WebsiteBriefStackPreference */
export type WebsiteTargetStack =
  import('./brief-types').WebsiteBriefStackPreference;

/* ------------------------------------------------------------------ */
/* Site Studio: style system — see style-tokens.ts (Prompt D1)         */
/* ------------------------------------------------------------------ */

export type {
  WebsiteStyleTokens,
  WebsiteStyleSystem,
  WebsiteMoodboardRef,
  WebsiteStyleColors,
  WebsiteStyleTypography,
  WebsiteStyleRadiusScale,
  WebsiteStyleSpacingDensity,
  WebsiteStyleButtonStyle,
} from './style-tokens';
export {
  WEBSITE_STYLE_TOKENS_SCHEMA_VERSION,
  emptyWebsiteStyleSystem,
  emptyWebsiteStyleTokens,
  normalizeWebsiteStyleSystem,
  normalizeWebsiteStyleTokens,
  seedStyleTokensBrandA,
  seedStyleTokensBrandB,
  styleSystemFromDbRow,
} from './style-tokens';

/* ------------------------------------------------------------------ */
/* Site Studio: per-page search readiness (SEO / GEO / AEO)            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Site Studio: per-page search readiness — see seo-types.ts (E1)      */
/* ------------------------------------------------------------------ */

export type {
  WebsiteSeoPageSeo,
  WebsiteSeoPageRecord,
  WebsiteSeoStatus,
  WebsiteSeoAnswerBlock,
  WebsiteSeoHeadingItem,
  WebsiteSeoInternalLink,
  WebsiteSeoImageAlt,
  WebsiteSeoPageFields,
} from './seo-types';
export {
  WEBSITE_SEO_SCHEMA_VERSION,
  emptyWebsiteSeoPageSeo,
  emptyWebsiteSeoPageFields,
  emptyWebsiteSeoPageRecord,
  normalizeWebsiteSeoPageSeo,
  normalizeWebsiteSeoPageRecord,
  seoCompleteness,
  seoHasMinimumPlan,
  siteTechnicalChecklist,
} from './seo-types';

/* ------------------------------------------------------------------ */
/* Site Studio: sharing                                                */
/* ------------------------------------------------------------------ */

export type WebsiteShareScope = 'sitemap' | 'wireframes' | 'design' | 'full';

export type WebsiteShareLink = {
  id: string;
  token: string;
  scope: WebsiteShareScope;
  expiresAt: string | null;
  createdAt: string;
};

/** Portal (authenticated client org) visibility for planning artefacts. */
export type WebsitePortalShareScope = 'off' | 'sitemap' | 'wireframes' | 'full';

/** Loaded Site Studio state for a website detail page. */
export type SiteStudioBundle = {
  enabled: boolean;
  brief: WebsiteBrief | null;
  briefProvenance: WebsiteBriefAiProvenance;
  style: WebsiteStyleSystem | null;
  seoPages: Record<string, WebsiteSeoPageRecord>;
  /** Edit-before-export llms.txt override (Prompt E2). Null → generate on export. */
  llmsTxt: string | null;
  shares: WebsiteShareLink[];
  portalScope: WebsitePortalShareScope;
  /** F2: Site tab editor when a site_sites row is linked (or ozer_sites stack for first publish). */
  hasOzerSite: boolean;
};

export function emptySiteStudioBundle(): SiteStudioBundle {
  return {
    enabled: false,
    brief: null,
    briefProvenance: emptyBriefAiProvenance(),
    style: null,
    seoPages: {},
    llmsTxt: null,
    shares: [],
    portalScope: 'off',
    hasOzerSite: false,
  };
}

export const ALL_PLANNING_TABS: WebsitePlanningTab[] = [
  'overview',
  'brief',
  'sitemap',
  'wireframe',
  'design',
  'seo',
  'site',
  'export',
  'build',
  'content',
];

/* ------------------------------------------------------------------ */
/* Display options                                                     */
/* ------------------------------------------------------------------ */

export const WIREFRAME_LAYOUT_OPTIONS: Array<{
  value: WebsiteWireframeLayout;
  label: string;
  hint: string;
}> = [
  { value: 'full', label: 'Full width', hint: 'Hero, banner, rich media' },
  { value: 'split', label: 'Split', hint: 'Text + image side by side' },
  { value: 'grid', label: 'Grid', hint: 'Multi-column features' },
  { value: 'cards', label: 'Cards', hint: 'Team, services, testimonials' },
  { value: 'cta', label: 'CTA band', hint: 'Conversion strip' },
  { value: 'footer', label: 'Footer', hint: 'Nav, contact, legal' },
];

export const SECTION_TYPE_OPTIONS: Array<{
  value: WebsiteSectionType;
  label: string;
  /** Tailwind-safe colour classes for chips/borders. */
  colorClass: string;
  dotClass: string;
}> = [
  {
    value: 'nav',
    label: 'Nav',
    colorClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'hero',
    label: 'Hero',
    colorClass: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    dotClass: 'bg-violet-400',
  },
  {
    value: 'proof',
    label: 'Proof',
    colorClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    dotClass: 'bg-amber-400',
  },
  {
    value: 'conversion',
    label: 'Conversion',
    colorClass: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    dotClass: 'bg-orange-400',
  },
  {
    value: 'content',
    label: 'Content',
    colorClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'footer',
    label: 'Footer',
    colorClass: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    dotClass: 'bg-slate-400',
  },
  {
    value: 'other',
    label: 'Other',
    colorClass:
      'border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)]',
    dotClass: 'bg-[var(--workspace-shell-text-muted)]',
  },
];

export const PAGE_TYPE_OPTIONS: Array<{
  value: WebsitePageType;
  label: string;
}> = [
  { value: 'home', label: 'Home' },
  { value: 'service', label: 'Service' },
  { value: 'location', label: 'Location' },
  { value: 'about', label: 'About' },
  { value: 'contact', label: 'Contact' },
  { value: 'blog-index', label: 'Blog index' },
  { value: 'blog-post', label: 'Blog post' },
  { value: 'legal', label: 'Legal' },
  { value: 'landing', label: 'Landing' },
  { value: 'other', label: 'Other' },
];

export const PLANNING_STATUS_OPTIONS: Array<{
  value: WebsitePlanningStatus;
  label: string;
  colorClass: string;
}> = [
  {
    value: 'draft',
    label: 'Draft',
    colorClass:
      'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]',
  },
  {
    value: 'approved',
    label: 'Approved',
    colorClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  {
    value: 'blocked',
    label: 'Changes requested',
    colorClass: 'border-red-500/40 bg-red-500/10 text-red-300',
  },
];

/** Resolve section colour tag (color preferred, sectionType fallback). */
export function sectionColor(
  section: Pick<WebsiteSitemapSection, 'color' | 'sectionType'> | undefined,
): WebsiteSectionType {
  return section?.color ?? section?.sectionType ?? 'other';
}

export function sectionTypeMeta(type: WebsiteSectionType | undefined) {
  return (
    SECTION_TYPE_OPTIONS.find((item) => item.value === (type ?? 'other')) ??
    SECTION_TYPE_OPTIONS[SECTION_TYPE_OPTIONS.length - 1]!
  );
}

/** High-contrast chips for light client-facing surfaces (portal / share links). */
export function portalSectionChipClass(type: WebsiteSectionType | undefined) {
  switch (type ?? 'other') {
    case 'nav':
      return 'border-sky-300 bg-sky-50 text-sky-950';
    case 'hero':
      return 'border-violet-300 bg-violet-50 text-violet-950';
    case 'proof':
      return 'border-amber-300 bg-amber-50 text-amber-950';
    case 'conversion':
      return 'border-orange-300 bg-orange-50 text-orange-950';
    case 'content':
      return 'border-emerald-300 bg-emerald-50 text-emerald-950';
    case 'footer':
      return 'border-slate-300 bg-slate-100 text-slate-900';
    default:
      return 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]';
  }
}

export function portalStatusChipClass(
  status: WebsitePlanningStatus | undefined,
) {
  switch (status ?? 'draft') {
    case 'approved':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'blocked':
      return 'border-red-300 bg-red-50 text-red-900';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-800';
  }
}

export function planningStatusMeta(status: WebsitePlanningStatus | undefined) {
  return (
    PLANNING_STATUS_OPTIONS.find(
      (item) => item.value === (status ?? 'draft'),
    ) ?? PLANNING_STATUS_OPTIONS[0]!
  );
}

export function createPlanningId() {
  return crypto.randomUUID();
}

export function slugifyPageTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
