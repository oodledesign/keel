export type WebsitePlanningTab =
  | 'overview'
  | 'brief'
  | 'sitemap'
  | 'wireframe'
  | 'design'
  | 'seo'
  | 'export'
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
  'export',
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
  /** Site Studio: colour-coded section job. */
  sectionType?: WebsiteSectionType;
  /** Site Studio: repeating component symbol — edit once, update all instances. */
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
  /** Reserved for free-form canvas positioning. */
  x?: number;
  y?: number;
  /** One-line search intent for this page. */
  seoIntent?: string;
  /** Client approval note (set from portal / public share). */
  approvalNote?: string;
};

export type WebsiteWireframeLayout =
  | 'full'
  | 'split'
  | 'grid'
  | 'cards'
  | 'cta'
  | 'footer';

export type WebsiteWireframeSection = {
  id: string;
  sitemapSectionId: string | null;
  title: string;
  layout: WebsiteWireframeLayout;
  contentNotes: string;
  /** Site Studio: section library variant key (see section-library.ts). */
  libraryKey?: string | null;
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

export type WebsiteContentDoc = {
  id: string;
  title: string;
  contentMd: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Site Studio: brief                                                  */
/* ------------------------------------------------------------------ */

export type WebsiteBriefReference = {
  url: string;
  why: string;
};

export type WebsiteTargetStack = 'webflow' | 'astro' | 'next' | 'undecided';

export type WebsiteBrief = {
  orgName: string;
  brandSummary: string;
  offer: string;
  audience: string;
  geography: string;
  /** Jobs-to-be-done — the conversation the site answers. */
  jobsToBeDone: string;
  objections: string;
  competitors: string;
  references: WebsiteBriefReference[];
  tone: string;
  constraints: string;
  conversionGoals: string;
  targetStack: WebsiteTargetStack;
  /** Does the client need a CMS with editors outside git? */
  cmsNeeded: boolean;
};

export function emptyWebsiteBrief(): WebsiteBrief {
  return {
    orgName: '',
    brandSummary: '',
    offer: '',
    audience: '',
    geography: '',
    jobsToBeDone: '',
    objections: '',
    competitors: '',
    references: [],
    tone: '',
    constraints: '',
    conversionGoals: '',
    targetStack: 'undecided',
    cmsNeeded: false,
  };
}

/* ------------------------------------------------------------------ */
/* Site Studio: style system                                           */
/* ------------------------------------------------------------------ */

export type WebsiteStyleTokens = {
  /** Canvas — neutrals, base layer. */
  canvas: string;
  /** Atmosphere — subtle backgrounds / gradients. */
  atmosphere: string;
  /** Accent — buttons, icons, highlights. */
  accent: string;
  /** Contrast — headings, body text. */
  contrast: string;
  secondary: string;
  headingFont: string;
  bodyFont: string;
  typeScale: 'compact' | 'regular' | 'display';
  radius: 'sharp' | 'soft' | 'round';
  spacingDensity: 'tight' | 'regular' | 'airy';
  photographyDirection: string;
};

export type WebsiteMoodboardRef = {
  url: string;
  note: string;
};

export type WebsiteStyleSystem = {
  tokens: WebsiteStyleTokens;
  moodboard: WebsiteMoodboardRef[];
  /** User locked the tokens — exports use them verbatim. */
  locked: boolean;
};

export function emptyWebsiteStyleSystem(): WebsiteStyleSystem {
  return {
    tokens: {
      canvas: '#FAFAF8',
      atmosphere: '#EFEDE7',
      accent: '#FF5C34',
      contrast: '#191919',
      secondary: '#2A9D8F',
      headingFont: '',
      bodyFont: '',
      typeScale: 'regular',
      radius: 'soft',
      spacingDensity: 'regular',
      photographyDirection: '',
    },
    moodboard: [],
    locked: false,
  };
}

/* ------------------------------------------------------------------ */
/* Site Studio: per-page search readiness (SEO / GEO / AEO)            */
/* ------------------------------------------------------------------ */

export type WebsiteAnswerBlock = {
  question: string;
  answer: string;
};

export type WebsiteSeoPageFields = {
  primaryKeyword: string;
  secondaryKeywords: string;
  title: string;
  metaDescription: string;
  h1: string;
  headingOutline: string;
  internalLinks: string;
  canonicalNotes: string;
  imageAltPlan: string;
  schemaTypes: string[];
  /** GEO / local. */
  localSeo: string;
  /** AEO — FAQ / entity answer blocks for LLM citation. */
  answerBlocks: WebsiteAnswerBlock[];
  entityNotes: string;
};

export function emptyWebsiteSeoPageFields(): WebsiteSeoPageFields {
  return {
    primaryKeyword: '',
    secondaryKeywords: '',
    title: '',
    metaDescription: '',
    h1: '',
    headingOutline: '',
    internalLinks: '',
    canonicalNotes: '',
    imageAltPlan: '',
    schemaTypes: [],
    localSeo: '',
    answerBlocks: [],
    entityNotes: '',
  };
}

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
  style: WebsiteStyleSystem | null;
  seoPages: Record<string, WebsiteSeoPageFields>;
  shares: WebsiteShareLink[];
  portalScope: WebsitePortalShareScope;
};

export function emptySiteStudioBundle(): SiteStudioBundle {
  return {
    enabled: false,
    brief: null,
    style: null,
    seoPages: {},
    shares: [],
    portalScope: 'off',
  };
}

export const ALL_PLANNING_TABS: WebsitePlanningTab[] = [
  'overview',
  'brief',
  'sitemap',
  'wireframe',
  'design',
  'seo',
  'export',
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
