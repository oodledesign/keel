/**
 * F1 — map SiteStudioExport → Ozer Sites page puck_data + theme tokens.
 * Pure: no database writes (service applies result).
 */
import type { Data } from '@puckeditor/core';
import { createHash } from 'crypto';

import {
  type WireframeSectionInput,
  sectionsToPuckData,
} from '@kit/site-blocks-core';

import type { ExportPage, SiteStudioExport } from '../export-contract';
import { emptyWebsiteStyleTokens } from '../style-tokens';
import { sectionsForPage, slugify } from './pack-utils';

export type OzerSitesPackPage = {
  slug: string;
  title: string;
  puckData: Data;
  sourceHash: string;
};

export type OzerSitesPack = {
  name: string;
  subdomain: string;
  themeTokens: Record<string, unknown>;
  pages: OzerSitesPackPage[];
};

function normalizeOzerPageSlug(slug: string): string {
  return slug === 'index' ? 'home' : slug;
}

function pageToWireframeSections(
  exp: SiteStudioExport,
  page: ExportPage,
): WireframeSectionInput[] {
  return sectionsForPage(page, exp.sections).map((section) => ({
    id: section.id,
    title: section.sectionType,
    layoutPreset: section.layoutPreset,
    componentKey: section.componentKey,
    sectionType: section.sectionType,
    copyOutline: section.copyOutline,
    copy:
      section.props && typeof section.props === 'object'
        ? {
            slots:
              'slots' in section.props &&
              section.props.slots &&
              typeof section.props.slots === 'object'
                ? (section.props.slots as Record<string, string>)
                : undefined,
            items:
              'items' in section.props && Array.isArray(section.props.items)
                ? (section.props.items as Array<{
                    slots?: Record<string, string>;
                  }>)
                : undefined,
          }
        : null,
  }));
}

export function hashPuckSource(data: Data): string {
  const stable = JSON.stringify(data, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      );
    }
    return value;
  });
  return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}

export function suggestOzerSubdomain(exp: SiteStudioExport): string {
  const raw =
    exp.brief?.org.name?.trim() ||
    exp.website.name?.trim() ||
    exp.website.domain?.split('.')[0] ||
    'site';
  return slugify(raw, 'site').slice(0, 48);
}

/**
 * Build an idempotent publish pack from the export contract.
 */
export function generateOzerSitesPack(exp: SiteStudioExport): OzerSitesPack {
  const pages =
    exp.sitemap.length > 0
      ? exp.sitemap
      : ([
          {
            slug: 'home',
            title: exp.website.name,
            description: '',
            pageType: 'home',
            parentId: null,
            status: 'draft',
            sectionIds: [],
          },
        ] satisfies ExportPage[]);

  const packPagesBySlug = new Map<string, OzerSitesPackPage>();

  for (const page of pages) {
    const slug = normalizeOzerPageSlug(page.slug);
    const sections = pageToWireframeSections(exp, page);
    const puckData =
      sections.length > 0
        ? sectionsToPuckData(sections)
        : ({ content: [], root: { props: { title: page.title } } } as Data);
    packPagesBySlug.set(slug, {
      slug,
      title: page.title,
      puckData,
      sourceHash: hashPuckSource(puckData),
    });
  }

  const packPages = Array.from(packPagesBySlug.values());

  return {
    name: exp.website.name || exp.brief?.org.name || 'Site',
    subdomain: suggestOzerSubdomain(exp),
    themeTokens: (exp.styleTokens ??
      emptyWebsiteStyleTokens()) as unknown as Record<string, unknown>,
    pages: packPages,
  };
}
