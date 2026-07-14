/**
 * SiteStudioExport — canonical versioned export contract (Prompt B1).
 *
 * Every exporter (Astro / Next / Webflow / prompt pack / future destinations)
 * MUST consume this document. Internal planning JSONB shapes may evolve freely;
 * ONLY this contract needs versioning discipline.
 *
 * Versioning rules:
 * - Additive / optional fields → minor bump (1.0 → 1.1). Consumers ignore unknowns.
 * - Renames, removals, type changes, or altered semantics → major bump (1.x → 2.0).
 * - Consumers MUST check `schemaVersion` and refuse major versions they do not
 *   understand (see `assertCompatibleExportSchemaVersion`).
 *
 * `buildExport(websiteId)` is the ONLY place that maps internal Site Studio
 * shapes → this contract. Pack builders should not read websites JSONB directly.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type WebsiteBrief,
  type WebsiteBriefStackPreference,
  normalizeWebsiteBrief,
} from './brief-types';
import {
  type WebsitePageType,
  type WebsitePlanningStatus,
  type WebsiteSectionType,
  type WebsiteSitemapPage,
  type WebsiteWireframePage,
} from './planning-types';
import { normalizeWebsiteSeoPageRecord } from './seo-types';
import { migrateSitemapPages } from './sitemap-document';
import {
  type WebsiteStyleTokens,
  normalizeWebsiteStyleTokens,
} from './style-tokens';

export const SITE_STUDIO_EXPORT_SCHEMA_VERSION = '3.0' as const;

export type SiteStudioExportSchemaVersion =
  typeof SITE_STUDIO_EXPORT_SCHEMA_VERSION;

/** Finalised style tokens (Prompt D1). */
export type StyleTokens = WebsiteStyleTokens;

/**
 * Per-page SEO / GEO / AEO pack (Prompt E1).
 * Mirrors WebsiteSeoPageSeo + pageSlug + approval status.
 */
export type ExportSeoPage = {
  pageSlug: string;
  status: 'draft' | 'approved';
  schemaVersion: string;
  keywords: {
    primary: string;
    secondary: string[];
  };
  meta: {
    title: string;
    description: string;
  };
  headingOutline: Array<{ level: number; text: string }>;
  internalLinks: Array<{ toSlug: string; anchorSuggestion: string }>;
  canonicalRule: string;
  slugRule: string;
  imageAltPlan: Array<{ imageRole: string; altPattern: string }>;
  schemaTypes: string[];
  geo: {
    isLocationPage: boolean;
    nap: string;
    serviceArea: string[];
    gbpCues: string[];
    localFaq: Array<{ question: string; draftAnswer: string }>;
  };
  aeo: {
    answerBlocks: Array<{ question: string; draftAnswer: string }>;
    definitions: string[];
    entityNotes: string;
  };
  technical: {
    indexable: boolean;
    ogImagePlan: string;
  };
};

export type ExportSeo = {
  pages: ExportSeoPage[];
};
export type ExportPage = {
  slug: string;
  title: string;
  description: string;
  pageType: WebsitePageType | 'other';
  parentId: string | null;
  status: WebsitePlanningStatus;
  sectionIds: string[];
};

export type ExportComponent = {
  /** Stable symbol key (header / footer / CTA band…). */
  key: string;
  title: string;
  sectionType: WebsiteSectionType | 'other';
  layoutPreset: string | null;
  props: Record<string, unknown>;
};

export type ExportSectionInstance = {
  id: string;
  pageSlug: string;
  sectionType: WebsiteSectionType | 'other';
  layoutPreset: string;
  componentKey?: string | null;
  props: Record<string, unknown>;
  copyOutline: string;
  /** Colour tag derived from section job (nav/hero/proof…). */
  colorTag: WebsiteSectionType | 'other';
  status: WebsitePlanningStatus;
};

export interface SiteStudioExport {
  schemaVersion: SiteStudioExportSchemaVersion;
  generatedAt: string;
  website: {
    id: string;
    name: string;
    domain?: string | null;
    stackPreference: WebsiteBriefStackPreference;
  };
  brief: WebsiteBrief | null;
  /** Null until Part D style system ships / is filled. */
  styleTokens: StyleTokens | null;
  sitemap: ExportPage[];
  repeatingComponents: ExportComponent[];
  sections: ExportSectionInstance[];
  /** Null until Part E SEO producers ship / are filled. */
  seo: ExportSeo | null;
  contentDocs: Array<{ title: string; url: string }>;
}

/** Refuse major versions the consumer does not understand. */
export function assertCompatibleExportSchemaVersion(
  schemaVersion: string,
  supportedMajor = 3,
): void {
  const major = Number.parseInt(schemaVersion.split('.')[0] ?? '', 10);
  if (!Number.isFinite(major) || major !== supportedMajor) {
    throw new Error(
      `Unsupported SiteStudioExport schemaVersion "${schemaVersion}" (supported major ${supportedMajor}.x)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Source → contract mapping (only entry for shape conversion)         */
/* ------------------------------------------------------------------ */

export type SiteStudioExportSources = {
  website: {
    id: string;
    name: string | null;
    domain: string | null;
    sitemap: unknown;
    wireframes: unknown;
  };
  brief: unknown | null;
  styleTokens: unknown | null;
  seoPages: Array<{
    page_id: string;
    page_slug?: string | null;
    fields?: unknown;
    seo?: unknown;
    status?: string | null;
  }>;
  contentDocs: Array<{ id: string; title: string }>;
  /** Injectable clock for deterministic tests. */
  generatedAt?: string;
};

function asSitemap(value: unknown): WebsiteSitemapPage[] {
  return migrateSitemapPages(value);
}

function asWireframes(value: unknown): WebsiteWireframePage[] {
  if (!Array.isArray(value)) return [];
  return value as WebsiteWireframePage[];
}

function orderSitemapPages(pages: WebsiteSitemapPage[]): WebsiteSitemapPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const children = new Map<string | null, WebsiteSitemapPage[]>();

  for (const page of pages) {
    const parentId =
      page.parentId && byId.has(page.parentId) ? page.parentId : null;
    const list = children.get(parentId) ?? [];
    list.push(page);
    children.set(parentId, list);
  }

  const ordered: WebsiteSitemapPage[] = [];
  const visit = (parentId: string | null) => {
    for (const page of children.get(parentId) ?? []) {
      ordered.push(page);
      visit(page.id);
    }
  };
  visit(null);

  // Orphans / cycles that slipped parent checks.
  const orderedIds = new Set(ordered.map((page) => page.id));
  for (const page of pages) {
    if (!orderedIds.has(page.id)) ordered.push(page);
  }
  return ordered;
}

/**
 * Pure mapper used by `buildExport` and unit tests.
 * Tolerates missing pieces — never throws on partial planning data.
 */
export function assembleSiteStudioExport(
  sources: SiteStudioExportSources,
): SiteStudioExport {
  const sitemapPages = orderSitemapPages(asSitemap(sources.website.sitemap));
  const wireframes = asWireframes(sources.website.wireframes);
  const wireframeByPageId = new Map(
    wireframes.map((page) => [page.pageId, page]),
  );

  let brief: WebsiteBrief | null = null;
  if (sources.brief && typeof sources.brief === 'object') {
    try {
      brief = normalizeWebsiteBrief(sources.brief);
    } catch {
      brief = null;
    }
  }

  let styleTokens: StyleTokens | null = null;
  if (sources.styleTokens && typeof sources.styleTokens === 'object') {
    styleTokens = normalizeWebsiteStyleTokens(sources.styleTokens);
  }

  const exportPages: ExportPage[] = [];
  const sections: ExportSectionInstance[] = [];
  const repeating = new Map<string, ExportComponent>();

  for (const page of sitemapPages) {
    const wireframe = wireframeByPageId.get(page.id) ?? null;
    const wireframeBySitemapSection = new Map(
      (wireframe?.sections ?? [])
        .filter((section) => section.sitemapSectionId)
        .map((section) => [section.sitemapSectionId as string, section]),
    );
    const usedWireframeIds = new Set<string>();
    const sectionIds: string[] = [];

    for (const sitemapSection of page.sections ?? []) {
      const wf = wireframeBySitemapSection.get(sitemapSection.id);
      if (wf) usedWireframeIds.add(wf.id);
      const sectionId = wf?.id ?? sitemapSection.id;
      sectionIds.push(sectionId);

      const sectionType = (sitemapSection.sectionType ?? 'other') as
        | WebsiteSectionType
        | 'other';
      const layoutPreset = String(
        wf?.layoutPreset ?? wf?.libraryKey ?? wf?.layout ?? 'full',
      );
      const props: Record<string, unknown> = wf?.copy
        ? { slots: wf.copy.slots, items: wf.copy.items ?? [] }
        : {};

      sections.push({
        id: sectionId,
        pageSlug: page.slug,
        sectionType,
        layoutPreset,
        componentKey: sitemapSection.componentKey ?? null,
        props,
        copyOutline: wf?.copyOutline?.trim() || '',
        colorTag: sectionType,
        status: sitemapSection.status ?? 'draft',
      });

      const componentKey = sitemapSection.componentKey?.trim();
      if (componentKey && !repeating.has(componentKey)) {
        repeating.set(componentKey, {
          key: componentKey,
          title: sitemapSection.title || componentKey,
          sectionType,
          layoutPreset,
          props,
        });
      }
    }

    for (const wf of wireframe?.sections ?? []) {
      if (usedWireframeIds.has(wf.id)) continue;
      sectionIds.push(wf.id);
      sections.push({
        id: wf.id,
        pageSlug: page.slug,
        sectionType: 'other',
        layoutPreset: String(
          wf.layoutPreset ?? wf.libraryKey ?? wf.layout ?? 'full',
        ),
        componentKey: null,
        props: wf.copy
          ? { slots: wf.copy.slots, items: wf.copy.items ?? [] }
          : {},
        copyOutline: wf.copyOutline?.trim() || '',
        colorTag: 'other',
        status: 'draft',
      });
    }

    exportPages.push({
      slug: page.slug,
      title: page.title,
      description: page.description?.trim() || page.seoIntent?.trim() || '',
      pageType: page.pageType ?? 'other',
      parentId: page.parentId ?? null,
      status: page.status ?? 'draft',
      sectionIds,
    });
  }

  let seo: ExportSeo | null = null;
  if (sources.seoPages.length > 0) {
    const pageIdToSlug = new Map(
      sitemapPages.map((page) => [page.id, page.slug]),
    );
    const pages: ExportSeoPage[] = [];

    for (const row of sources.seoPages) {
      const slug =
        (row.page_slug && String(row.page_slug).trim()) ||
        pageIdToSlug.get(row.page_id);
      if (!slug) continue;

      const record = normalizeWebsiteSeoPageRecord(
        {
          page_id: row.page_id,
          page_slug: slug,
          seo: row.seo,
          fields: row.fields,
          status: row.status,
        },
        row.page_id,
        slug,
      );

      pages.push({
        pageSlug: slug,
        status: record.status,
        schemaVersion: record.seo.schemaVersion,
        keywords: record.seo.keywords,
        meta: record.seo.meta,
        headingOutline: record.seo.headingOutline,
        internalLinks: record.seo.internalLinks,
        canonicalRule: record.seo.canonicalRule,
        slugRule: record.seo.slugRule,
        imageAltPlan: record.seo.imageAltPlan,
        schemaTypes: record.seo.schemaTypes,
        geo: record.seo.geo,
        aeo: record.seo.aeo,
        technical: record.seo.technical,
      });
    }

    if (pages.length > 0) seo = { pages };
  }

  return {
    schemaVersion: SITE_STUDIO_EXPORT_SCHEMA_VERSION,
    generatedAt: sources.generatedAt ?? new Date().toISOString(),
    website: {
      id: sources.website.id,
      name: sources.website.name?.trim() || 'Website',
      domain: sources.website.domain,
      stackPreference: brief?.stackPreference ?? 'undecided',
    },
    brief,
    styleTokens,
    sitemap: exportPages,
    repeatingComponents: [...repeating.values()],
    sections,
    seo,
    contentDocs: sources.contentDocs.map((doc) => ({
      title: doc.title?.trim() || 'Untitled',
      url: `#content/${doc.id}`,
    })),
  };
}

async function loadExportSources(
  websiteId: string,
  client: SupabaseClient = getSupabaseServerAdminClient() as SupabaseClient,
): Promise<SiteStudioExportSources> {
  const [websiteRes, briefRes, styleRes, seoRes, docsRes] = await Promise.all([
    client
      .from('websites')
      .select('id, name, domain, sitemap, wireframes')
      .eq('id', websiteId)
      .maybeSingle(),
    client
      .from('website_briefs')
      .select('brief')
      .eq('website_id', websiteId)
      .maybeSingle(),
    client
      .from('website_style_systems')
      .select('style, tokens')
      .eq('website_id', websiteId)
      .maybeSingle(),
    client
      .from('website_seo_pages')
      .select('page_id, page_slug, fields, seo, status')
      .eq('website_id', websiteId),
    client
      .from('website_content_docs')
      .select('id, title')
      .eq('website_id', websiteId)
      .order('sort_order', { ascending: true }),
  ]);

  // Missing optional tables/rows are fine — only the website row is required.
  const website = websiteRes.data as {
    id: string;
    name: string | null;
    domain: string | null;
    sitemap: unknown;
    wireframes: unknown;
  } | null;

  if (!website?.id) {
    throw new Error('Website not found');
  }

  let seoPages: SiteStudioExportSources['seoPages'] = [];
  if (seoRes.error) {
    const message = String(
      (seoRes.error as { message?: string }).message ?? seoRes.error,
    );
    const missingColumn =
      /column .* does not exist/i.test(message) ||
      /Could not find the .* column/i.test(message);
    if (missingColumn) {
      const legacy = await client
        .from('website_seo_pages')
        .select('page_id, fields')
        .eq('website_id', websiteId);
      seoPages = (
        (legacy.data ?? []) as Array<{
          page_id: string;
          fields?: unknown;
        }>
      ).map((row) => ({
        page_id: row.page_id,
        page_slug: null,
        fields: row.fields,
        seo: null,
        status: 'draft',
      }));
    }
  } else {
    seoPages = (
      (seoRes.data ?? []) as Array<{
        page_id: string;
        page_slug?: string | null;
        fields?: unknown;
        seo?: unknown;
        status?: string | null;
      }>
    ).map((row) => ({
      page_id: row.page_id,
      page_slug: row.page_slug ?? null,
      fields: row.fields,
      seo: row.seo,
      status: row.status ?? null,
    }));
  }

  const styleRow = styleRes.data as {
    style?: { tokens?: unknown };
    tokens?: unknown;
  } | null;
  const dedicatedTokens = styleRow?.tokens;
  const legacyTokens =
    styleRow?.style &&
    typeof styleRow.style === 'object' &&
    'tokens' in styleRow.style
      ? (styleRow.style as { tokens: unknown }).tokens
      : null;
  const styleTokens =
    dedicatedTokens &&
    typeof dedicatedTokens === 'object' &&
    Object.keys(dedicatedTokens as object).length > 0
      ? dedicatedTokens
      : legacyTokens;

  return {
    website,
    brief: (briefRes.data as { brief?: unknown } | null)?.brief ?? null,
    styleTokens,
    seoPages,
    contentDocs: (
      (docsRes.data ?? []) as Array<{ id: string; title: string }>
    ).map((row) => ({
      id: row.id,
      title: row.title,
    })),
  };
}

/**
 * Build the canonical SiteStudioExport for a website.
 * Reads JSONB + related tables; never throws on partial optional data.
 */
export async function buildExport(
  websiteId: string,
  options?: {
    /** Override source loader (unit tests). */
    loadSources?: (websiteId: string) => Promise<SiteStudioExportSources>;
  },
): Promise<SiteStudioExport> {
  const sources = await (options?.loadSources ?? loadExportSources)(websiteId);
  return assembleSiteStudioExport(sources);
}
