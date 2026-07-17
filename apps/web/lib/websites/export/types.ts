import type {
  WebsiteBrief,
  WebsiteSitemapPage,
  WebsiteStyleSystem,
  WebsiteWireframePage,
} from '../planning-types';
import {
  type LegacyFlatSeoFields,
  toLegacyFlatSeoFields,
} from '../seo-legacy-flat';
import {
  type WebsiteSeoPageSeo,
  normalizeWebsiteSeoPageSeo,
} from '../seo-types';

export type WebsiteExportFile = {
  /** Relative path inside the pack, e.g. "src/pages/index.astro". */
  path: string;
  /** Language hint for syntax highlighting. */
  language: string;
  content: string;
};

export type WebsiteExportInput = {
  websiteName: string;
  domain: string | null;
  brief: WebsiteBrief | null;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  /** Keyed by sitemap page id — E1 nested seo or record wrappers. */
  seoPages: Record<string, WebsiteSeoPageSeo | { seo?: unknown } | null>;
};

export function wireframeForPage(
  input: WebsiteExportInput,
  pageId: string,
): WebsiteWireframePage | null {
  return input.wireframes.find((page) => page.pageId === pageId) ?? null;
}

export function seoForPage(
  input: WebsiteExportInput,
  pageId: string,
): LegacyFlatSeoFields | null {
  const raw = input.seoPages[pageId];
  if (!raw) return null;
  if ('seo' in raw && raw.seo) {
    return toLegacyFlatSeoFields(normalizeWebsiteSeoPageSeo(raw.seo));
  }
  return toLegacyFlatSeoFields(normalizeWebsiteSeoPageSeo(raw));
}

export function pageRoute(page: WebsiteSitemapPage): string {
  return page.slug === 'home' || page.slug === 'index' ? '/' : `/${page.slug}`;
}

export function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}
