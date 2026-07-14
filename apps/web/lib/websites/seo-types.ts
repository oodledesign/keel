/**
 * Site Studio per-page search readiness (Prompt E1).
 * Stored in website_seo_pages.seo jsonb (schemaVersion inside).
 */

export const WEBSITE_SEO_SCHEMA_VERSION = '1.0' as const;

export type WebsiteSeoStatus = 'draft' | 'approved';

export type WebsiteSeoHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type WebsiteSeoHeadingItem = {
  level: WebsiteSeoHeadingLevel;
  text: string;
};

export type WebsiteSeoInternalLink = {
  toSlug: string;
  anchorSuggestion: string;
};

export type WebsiteSeoImageAlt = {
  imageRole: string;
  altPattern: string;
};

export type WebsiteSeoAnswerBlock = {
  question: string;
  draftAnswer: string;
};

export type WebsiteSeoPageSeo = {
  schemaVersion: typeof WEBSITE_SEO_SCHEMA_VERSION;
  keywords: {
    primary: string;
    secondary: string[];
  };
  meta: {
    title: string;
    description: string;
  };
  headingOutline: WebsiteSeoHeadingItem[];
  internalLinks: WebsiteSeoInternalLink[];
  canonicalRule: string;
  slugRule: string;
  imageAltPlan: WebsiteSeoImageAlt[];
  schemaTypes: string[];
  geo: {
    isLocationPage: boolean;
    nap: string;
    serviceArea: string[];
    gbpCues: string[];
    localFaq: WebsiteSeoAnswerBlock[];
  };
  aeo: {
    answerBlocks: WebsiteSeoAnswerBlock[];
    definitions: string[];
    entityNotes: string;
  };
  technical: {
    indexable: boolean;
    ogImagePlan: string;
  };
};

/** Runtime row loaded for the Search tab (keyed by sitemap page id). */
export type WebsiteSeoPageRecord = {
  pageId: string;
  pageSlug: string;
  seo: WebsiteSeoPageSeo;
  status: WebsiteSeoStatus;
};

export function emptyWebsiteSeoPageSeo(): WebsiteSeoPageSeo {
  return {
    schemaVersion: WEBSITE_SEO_SCHEMA_VERSION,
    keywords: { primary: '', secondary: [] },
    meta: { title: '', description: '' },
    headingOutline: [],
    internalLinks: [],
    canonicalRule: '',
    slugRule: '',
    imageAltPlan: [],
    schemaTypes: [],
    geo: {
      isLocationPage: false,
      nap: '',
      serviceArea: [],
      gbpCues: [],
      localFaq: [],
    },
    aeo: {
      answerBlocks: [],
      definitions: [],
      entityNotes: '',
    },
    technical: {
      indexable: true,
      ogImagePlan: '',
    },
  };
}

export function emptyWebsiteSeoPageRecord(
  pageId = '',
  pageSlug = '',
): WebsiteSeoPageRecord {
  return {
    pageId,
    pageSlug,
    seo: emptyWebsiteSeoPageSeo(),
    status: 'draft',
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseHeadingOutline(raw: unknown): WebsiteSeoHeadingItem[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as { level?: unknown; text?: unknown };
        const levelNum = Number(row.level);
        const level = (
          levelNum >= 1 && levelNum <= 6 ? levelNum : 2
        ) as WebsiteSeoHeadingLevel;
        return { level, text: String(row.text ?? '').trim() };
      })
      .filter((item) => item.text);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(H([1-6])[:\s.-]*)?(.*)$/i.exec(line);
      const level = (
        match?.[2] ? Number(match[2]) : 2
      ) as WebsiteSeoHeadingLevel;
      const text = (match?.[3] ?? line).trim();
      return { level, text };
    })
    .filter((item) => item.text);
}

function parseInternalLinks(raw: unknown): WebsiteSeoInternalLink[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as {
          toSlug?: unknown;
          anchorSuggestion?: unknown;
          slug?: unknown;
        };
        return {
          toSlug: String(row.toSlug ?? row.slug ?? '')
            .replace(/^\//, '')
            .trim(),
          anchorSuggestion: String(row.anchorSuggestion ?? '').trim(),
        };
      })
      .filter((item) => item.toSlug);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [slugPart, ...rest] = line.split(/\s*[-–—:]\s*/);
      const toSlug = (slugPart ?? '')
        .replace(/^\//, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
      return {
        toSlug,
        anchorSuggestion: rest.join(' — ').trim() || toSlug,
      };
    })
    .filter((item) => item.toSlug);
}

function parseImageAltPlan(raw: unknown): WebsiteSeoImageAlt[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as { imageRole?: unknown; altPattern?: unknown };
        return {
          imageRole: String(row.imageRole ?? '').trim(),
          altPattern: String(row.altPattern ?? '').trim(),
        };
      })
      .filter((item) => item.imageRole || item.altPattern);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [role, ...rest] = line.split(/[-–—:]/);
      return {
        imageRole: (role ?? 'image').trim(),
        altPattern: rest.join(':').trim() || line,
      };
    });
}

function parseAnswerBlocks(raw: unknown): WebsiteSeoAnswerBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as {
        question?: unknown;
        draftAnswer?: unknown;
        answer?: unknown;
      };
      return {
        question: String(row.question ?? '').trim(),
        draftAnswer: String(row.draftAnswer ?? row.answer ?? '').trim(),
      };
    })
    .filter((item) => item.question);
}

/** Migrate E1 nested or legacy flat fields into WebsiteSeoPageSeo. */
export function normalizeWebsiteSeoPageSeo(input: unknown): WebsiteSeoPageSeo {
  const empty = emptyWebsiteSeoPageSeo();
  if (!input || typeof input !== 'object') return empty;

  const raw = input as Record<string, unknown>;

  // Nested E1 already
  if (raw.keywords && typeof raw.keywords === 'object') {
    const keywords = raw.keywords as { primary?: unknown; secondary?: unknown };
    const meta = (raw.meta ?? {}) as {
      title?: unknown;
      description?: unknown;
    };
    const geo = (raw.geo ?? {}) as Record<string, unknown>;
    const aeo = (raw.aeo ?? {}) as Record<string, unknown>;
    const technical = (raw.technical ?? {}) as Record<string, unknown>;

    return {
      schemaVersion: WEBSITE_SEO_SCHEMA_VERSION,
      keywords: {
        primary: String(keywords.primary ?? ''),
        secondary: asStringArray(keywords.secondary),
      },
      meta: {
        title: String(meta.title ?? ''),
        description: String(meta.description ?? ''),
      },
      headingOutline: parseHeadingOutline(raw.headingOutline),
      internalLinks: parseInternalLinks(raw.internalLinks),
      canonicalRule: String(raw.canonicalRule ?? raw.canonicalNotes ?? ''),
      slugRule: String(raw.slugRule ?? ''),
      imageAltPlan: parseImageAltPlan(raw.imageAltPlan),
      schemaTypes: asStringArray(raw.schemaTypes).slice(0, 12),
      geo: {
        isLocationPage: Boolean(geo.isLocationPage),
        nap: String(geo.nap ?? ''),
        serviceArea: asStringArray(geo.serviceArea),
        gbpCues: asStringArray(geo.gbpCues),
        localFaq: parseAnswerBlocks(geo.localFaq),
      },
      aeo: {
        answerBlocks: parseAnswerBlocks(aeo.answerBlocks ?? raw.answerBlocks),
        definitions: asStringArray(aeo.definitions),
        entityNotes: String(aeo.entityNotes ?? raw.entityNotes ?? ''),
      },
      technical: {
        indexable:
          technical.indexable === undefined
            ? true
            : Boolean(technical.indexable),
        ogImagePlan: String(technical.ogImagePlan ?? ''),
      },
    };
  }

  // Legacy flat WebsiteSeoPageFields
  const headingFromH1 = String(raw.h1 ?? '').trim();
  const headingOutline = parseHeadingOutline(raw.headingOutline);
  if (headingFromH1 && !headingOutline.some((item) => item.level === 1)) {
    headingOutline.unshift({ level: 1, text: headingFromH1 });
  }

  return {
    schemaVersion: WEBSITE_SEO_SCHEMA_VERSION,
    keywords: {
      primary: String(raw.primaryKeyword ?? ''),
      secondary: asStringArray(raw.secondaryKeywords),
    },
    meta: {
      title: String(raw.title ?? ''),
      description: String(raw.metaDescription ?? ''),
    },
    headingOutline,
    internalLinks: parseInternalLinks(raw.internalLinks),
    canonicalRule: String(raw.canonicalNotes ?? raw.canonicalRule ?? ''),
    slugRule: String(raw.slugRule ?? ''),
    imageAltPlan: parseImageAltPlan(raw.imageAltPlan),
    schemaTypes: asStringArray(raw.schemaTypes).slice(0, 12),
    geo: {
      isLocationPage: Boolean(raw.localSeo),
      nap: '',
      serviceArea: [],
      gbpCues: [],
      localFaq: [],
    },
    aeo: {
      answerBlocks: parseAnswerBlocks(raw.answerBlocks),
      definitions: [],
      entityNotes: String(raw.entityNotes ?? ''),
    },
    technical: {
      indexable: true,
      ogImagePlan: '',
    },
  };
}

export function normalizeWebsiteSeoPageRecord(
  input: unknown,
  fallbackPageId = '',
  fallbackSlug = '',
): WebsiteSeoPageRecord {
  if (!input || typeof input !== 'object') {
    return emptyWebsiteSeoPageRecord(fallbackPageId, fallbackSlug);
  }

  const raw = input as Record<string, unknown>;
  const seoSource = raw.seo ?? raw.fields ?? raw;
  const status =
    raw.status === 'approved' ? ('approved' as const) : ('draft' as const);

  return {
    pageId: String(raw.pageId ?? raw.page_id ?? fallbackPageId),
    pageSlug: String(raw.pageSlug ?? raw.page_slug ?? fallbackSlug),
    seo: normalizeWebsiteSeoPageSeo(seoSource),
    status,
  };
}

/** Completeness 0–100 for Search tab indicators. */
export function seoCompleteness(seo: WebsiteSeoPageSeo): number {
  const checks = [
    Boolean(seo.keywords.primary.trim()),
    seo.keywords.secondary.length > 0,
    Boolean(seo.meta.title.trim()),
    Boolean(seo.meta.description.trim()),
    seo.headingOutline.length > 0,
    seo.internalLinks.length > 0,
    seo.schemaTypes.length > 0,
    seo.aeo.answerBlocks.length > 0,
    Boolean(seo.aeo.entityNotes.trim()),
    Boolean(seo.slugRule.trim() || seo.canonicalRule.trim()),
  ];
  const hit = checks.filter(Boolean).length;
  return Math.round((hit / checks.length) * 100);
}

export function seoHasMinimumPlan(seo: WebsiteSeoPageSeo): boolean {
  return (
    Boolean(seo.keywords.primary.trim()) &&
    Boolean(seo.meta.title.trim()) &&
    Boolean(seo.meta.description.trim()) &&
    seo.headingOutline.length > 0
  );
}

/** Site-level technical checklist (derived — not stored). */
export function siteTechnicalChecklist(stackPreference: string): Array<{
  id: string;
  label: string;
  detail: string;
}> {
  const stack = stackPreference || 'undecided';
  const cwv =
    stack === 'webflow'
      ? 'Webflow: target LCP < 2.5s, CLS < 0.1; compress CMS images; avoid heavy embeds above the fold.'
      : stack === 'astro'
        ? 'Astro: static-first; partial hydration; LCP < 2.5s, INP < 200ms, CLS < 0.1.'
        : stack === 'next' || stack === 'ozer_sites'
          ? 'Next / ozer_sites: App Router streaming; optimize images; LCP < 2.5s, INP < 200ms, CLS < 0.1.'
          : 'Set stack preference, then apply CWV targets for that stack (LCP < 2.5s, INP < 200ms, CLS < 0.1).';

  return [
    {
      id: 'sitemap',
      label: 'sitemap.xml plan',
      detail:
        'Publish an XML sitemap of all indexable routes; submit in Search Console / Bing Webmaster.',
    },
    {
      id: 'robots',
      label: 'robots.txt',
      detail:
        'Allow crawl of public pages; disallow preview/staging and client portals; point Sitemap: URL.',
    },
    {
      id: 'cwv',
      label: 'Core Web Vitals targets',
      detail: cwv,
    },
    {
      id: 'hreflang',
      label: 'hreflang note',
      detail:
        'Only needed for multi-locale sites. If single locale, skip hreflang and use a single canonical host.',
    },
  ];
}

/** @deprecated Use WebsiteSeoPageSeo — kept for transitional imports. */
export type WebsiteSeoPageFields = WebsiteSeoPageSeo;
/** @deprecated Use emptyWebsiteSeoPageSeo. */
export const emptyWebsiteSeoPageFields = emptyWebsiteSeoPageSeo;
