/**
 * Versioned sitemap document (Prompt C1).
 *
 * Stored in websites.sitemap JSONB as either:
 * - Legacy: WebsiteSitemapPage[]
 * - v1: { schemaVersion, pages, components }
 *
 * Always upgrade lazily via migrateSitemapDocument — never a SQL data migration.
 */

import {
  createPlanningId,
  type WebsitePlanningStatus,
  type WebsiteSectionType,
  type WebsiteSitemapPage,
  type WebsiteSitemapSection,
  type WebsiteSitemapSymbol,
  type WebsiteSitemapDocument,
  WEBSITE_SITEMAP_SCHEMA_VERSION,
} from './planning-types';

const SECTION_TYPES = new Set<WebsiteSectionType>([
  'nav',
  'hero',
  'proof',
  'conversion',
  'content',
  'footer',
  'other',
]);

const STATUSES = new Set<WebsitePlanningStatus>([
  'draft',
  'approved',
  'blocked',
]);

function asSectionType(value: unknown): WebsiteSectionType {
  return typeof value === 'string' && SECTION_TYPES.has(value as WebsiteSectionType)
    ? (value as WebsiteSectionType)
    : 'other';
}

function asStatus(value: unknown): WebsitePlanningStatus {
  return typeof value === 'string' && STATUSES.has(value as WebsitePlanningStatus)
    ? (value as WebsitePlanningStatus)
    : 'draft';
}

function migrateSection(raw: unknown): WebsiteSitemapSection {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const color = asSectionType(row.color ?? row.sectionType);
  return {
    id: typeof row.id === 'string' ? row.id : createPlanningId(),
    title: typeof row.title === 'string' ? row.title : 'Untitled section',
    description: typeof row.description === 'string' ? row.description : '',
    color,
    sectionType: color,
    componentKey:
      typeof row.componentKey === 'string' && row.componentKey.trim()
        ? row.componentKey.trim()
        : null,
    status: asStatus(row.status),
  };
}

function migratePage(raw: unknown, index: number): WebsiteSitemapPage {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const sections = Array.isArray(row.sections)
    ? row.sections.map(migrateSection)
    : [];

  const x =
    typeof row.x === 'number' && Number.isFinite(row.x)
      ? row.x
      : 80 + (index % 4) * 320;
  const y =
    typeof row.y === 'number' && Number.isFinite(row.y)
      ? row.y
      : 80 + Math.floor(index / 4) * 280;

  return {
    id: typeof row.id === 'string' ? row.id : createPlanningId(),
    title: typeof row.title === 'string' ? row.title : 'Untitled page',
    slug: typeof row.slug === 'string' ? row.slug : `page-${index + 1}`,
    sections,
    description: typeof row.description === 'string' ? row.description : '',
    pageType:
      typeof row.pageType === 'string'
        ? (row.pageType as WebsiteSitemapPage['pageType'])
        : 'other',
    status: asStatus(row.status),
    parentId: typeof row.parentId === 'string' ? row.parentId : null,
    x,
    y,
    seoIntent: typeof row.seoIntent === 'string' ? row.seoIntent : '',
    approvalNote:
      typeof row.approvalNote === 'string' ? row.approvalNote : undefined,
  };
}

function migrateSymbol(raw: unknown): WebsiteSitemapSymbol | null {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const key =
    typeof row.key === 'string'
      ? row.key.trim()
      : typeof row.componentKey === 'string'
        ? row.componentKey.trim()
        : '';
  if (!key) return null;
  const color = asSectionType(row.color ?? row.sectionType);
  return {
    key,
    title: typeof row.title === 'string' ? row.title : key,
    description: typeof row.description === 'string' ? row.description : '',
    color,
    status: asStatus(row.status),
  };
}

/** Infer symbols from section componentKey usage when components[] is empty. */
function inferComponentsFromPages(
  pages: WebsiteSitemapPage[],
): WebsiteSitemapSymbol[] {
  const map = new Map<string, WebsiteSitemapSymbol>();
  for (const page of pages) {
    for (const section of page.sections) {
      const key = section.componentKey?.trim();
      if (!key || map.has(key)) continue;
      map.set(key, {
        key,
        title: section.title || key,
        description: section.description || '',
        color: section.color ?? section.sectionType ?? 'other',
        status: section.status ?? 'draft',
      });
    }
  }
  return [...map.values()];
}

/**
 * Upgrade any stored sitemap JSONB to the v1 document shape.
 * Safe for array (legacy) or partial objects.
 */
export function migrateSitemapDocument(raw: unknown): WebsiteSitemapDocument {
  if (Array.isArray(raw)) {
    const pages = raw.map((page, index) => migratePage(page, index));
    return {
      schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
      pages,
      components: inferComponentsFromPages(pages),
    };
  }

  if (raw && typeof raw === 'object') {
    const row = raw as Record<string, unknown>;
    const pagesRaw = Array.isArray(row.pages)
      ? row.pages
      : Array.isArray(row.sitemap)
        ? row.sitemap
        : [];
    const pages = pagesRaw.map((page, index) => migratePage(page, index));
    const componentsRaw = Array.isArray(row.components) ? row.components : [];
    const components = componentsRaw
      .map(migrateSymbol)
      .filter((item): item is WebsiteSitemapSymbol => Boolean(item));

    return {
      schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
      pages,
      components:
        components.length > 0 ? components : inferComponentsFromPages(pages),
    };
  }

  return {
    schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
    pages: [],
    components: [],
  };
}

/** Pages helper for consumers that only need the page list. */
export function migrateSitemapPages(raw: unknown): WebsiteSitemapPage[] {
  return migrateSitemapDocument(raw).pages;
}

/**
 * Apply symbol definition onto every section instance with that componentKey.
 * Returns updated pages (immutable).
 */
export function applySymbolToPages(
  pages: WebsiteSitemapPage[],
  symbol: WebsiteSitemapSymbol,
): WebsiteSitemapPage[] {
  return pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) =>
      section.componentKey === symbol.key
        ? {
            ...section,
            title: symbol.title,
            description: symbol.description,
            color: symbol.color,
            sectionType: symbol.color,
            status: symbol.status,
          }
        : section,
    ),
  }));
}

/** Default starter symbols for the Symbols drawer. */
export const DEFAULT_SITEMAP_SYMBOLS: WebsiteSitemapSymbol[] = [
  {
    key: 'site-header',
    title: 'Header',
    description: 'Primary navigation + logo',
    color: 'nav',
    status: 'draft',
  },
  {
    key: 'site-footer',
    title: 'Footer',
    description: 'Footer links + legal',
    color: 'footer',
    status: 'draft',
  },
  {
    key: 'cta-band',
    title: 'CTA band',
    description: 'Shared conversion band',
    color: 'conversion',
    status: 'draft',
  },
  {
    key: 'service-card',
    title: 'Service card',
    description: 'Reusable service teaser',
    color: 'content',
    status: 'draft',
  },
];
