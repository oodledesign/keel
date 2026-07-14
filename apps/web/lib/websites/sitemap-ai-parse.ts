import { z } from 'zod';

import {
  createPlanningId,
  slugifyPageTitle,
  type WebsiteLayoutPreset,
  type WebsitePageType,
  type WebsitePlanningStatus,
  type WebsiteSectionType,
  type WebsiteSitemapPage,
  type WebsiteSitemapSection,
  type WebsiteWireframeCopy,
  type WebsiteWireframeLayout,
  type WebsiteWireframeSection,
} from './planning-types';
import { findSectionLibraryEntry } from './section-library';
import { ensureWireframeCopy } from './wireframe-copy';
import {
  LEGACY_LIBRARY_KEY_TO_PRESET,
  SITE_BLOCK_LAYOUT_PRESETS,
} from '@kit/site-blocks-core/mapping';

const PAGE_TYPES = new Set<WebsitePageType>([
  'home',
  'service',
  'location',
  'about',
  'contact',
  'blog-index',
  'blog-post',
  'legal',
  'landing',
  'other',
]);

const SECTION_TYPES = new Set<WebsiteSectionType>([
  'nav',
  'hero',
  'proof',
  'conversion',
  'content',
  'footer',
  'other',
]);

const LAYOUTS = new Set<WebsiteWireframeLayout>([
  'full',
  'split',
  'grid',
  'cards',
  'cta',
  'footer',
]);

/** Strict Zod schema for AI sitemap page output (pre-ID normalisation). */
export const AiSitemapSectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sectionType: z.string().max(40).optional(),
  color: z.string().max(40).optional(),
  componentKey: z.string().max(100).nullable().optional(),
  status: z.enum(['draft', 'approved', 'blocked']).optional(),
});

export const AiSitemapPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  pageType: z.string().max(40).optional(),
  seoIntent: z.string().max(500).optional(),
  parentSlug: z.string().max(200).nullable().optional(),
  status: z.enum(['draft', 'approved', 'blocked']).optional(),
  sections: z.array(AiSitemapSectionSchema).max(20).optional(),
});

export const AiSitemapPagesSchema = z.array(AiSitemapPageSchema).min(1).max(40);

export type AiSitemapPage = z.infer<typeof AiSitemapPageSchema>;

/** Structured client-shareable copy outline (C2). */
export const AiCopyOutlineObjectSchema = z.object({
  headline: z.string().max(500).optional(),
  subhead: z.string().max(1000).optional(),
  bullets: z.array(z.string().max(500)).max(12).optional(),
  ctaLabel: z.string().max(120).optional(),
});

export const AiWireframeSectionSchema = z.object({
  sitemapSectionTitle: z.string().max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  /** Preferred name in prompts; alias of layout. */
  layoutPreset: z.string().max(40).optional(),
  layout: z.string().max(40).optional(),
  libraryKey: z.string().max(100).nullable().optional(),
  copyOutline: z
    .union([z.string().max(10000), AiCopyOutlineObjectSchema])
    .optional(),
  /** Internal-only notes — must stay out of client-shareable copy. */
  contentNotes: z.string().max(10000).optional().default(''),
  copy: z
    .object({
      slots: z.record(z.string(), z.string().max(10000)).optional(),
      items: z
        .array(
          z.object({
            slots: z.record(z.string(), z.string().max(10000)).optional(),
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),
});

export const AiWireframeSectionsSchema = z
  .array(AiWireframeSectionSchema)
  .min(1)
  .max(30);

export type AiWireframeSection = z.infer<typeof AiWireframeSectionSchema>;

function asPageType(value: string | undefined): WebsitePageType {
  return PAGE_TYPES.has(value as WebsitePageType)
    ? (value as WebsitePageType)
    : 'other';
}

function asSectionType(value: string | undefined): WebsiteSectionType {
  return SECTION_TYPES.has(value as WebsiteSectionType)
    ? (value as WebsiteSectionType)
    : 'other';
}

function asLayout(value: string | undefined): WebsiteWireframeLayout | null {
  return LAYOUTS.has(value as WebsiteWireframeLayout)
    ? (value as WebsiteWireframeLayout)
    : null;
}

function formatCopyOutline(
  outline: AiWireframeSection['copyOutline'],
): string {
  if (!outline) return '';
  if (typeof outline === 'string') return outline.slice(0, 10000);

  const lines: string[] = [];
  if (outline.headline) lines.push(outline.headline);
  if (outline.subhead) lines.push(outline.subhead);
  for (const bullet of outline.bullets ?? []) {
    lines.push(`• ${bullet}`);
  }
  if (outline.ctaLabel) lines.push(`CTA: ${outline.ctaLabel}`);
  return lines.join('\n').slice(0, 10000);
}

function outlineToSlots(
  outline: AiWireframeSection['copyOutline'],
): Record<string, string> {
  if (!outline || typeof outline === 'string') return {};
  const slots: Record<string, string> = {};
  if (outline.headline) slots.headline = outline.headline;
  if (outline.subhead) {
    slots.subheadline = outline.subhead;
    slots.subhead = outline.subhead;
  }
  if (outline.ctaLabel) {
    slots.primaryCta = outline.ctaLabel;
    slots['primary cta'] = outline.ctaLabel;
  }
  return slots;
}

/**
 * Map validated AI sitemap pages into WebsiteSitemapPage[] with fresh IDs
 * and parentSlug → parentId resolution (within proposed pages and optional
 * existing sitemap).
 */
export function materialiseAiSitemapPages(
  rawPages: AiSitemapPage[],
  options?: {
    existingPages?: WebsiteSitemapPage[];
  },
): WebsiteSitemapPage[] {
  const componentSections = new Map<string, WebsiteSitemapSection>();

  const newPages: Array<WebsiteSitemapPage & { _parentSlug: string | null }> =
    rawPages.slice(0, 40).map((page) => {
      const sections: WebsiteSitemapSection[] = (page.sections ?? [])
        .slice(0, 20)
        .map((section) => {
          const componentKey =
            typeof section.componentKey === 'string' &&
            section.componentKey.trim()
              ? section.componentKey.trim()
              : null;

          if (componentKey) {
            const canonical = componentSections.get(componentKey);
            if (canonical) {
              return { ...canonical, id: createPlanningId() };
            }
          }

          const color = asSectionType(section.color ?? section.sectionType);
          const mapped: WebsiteSitemapSection = {
            id: createPlanningId(),
            title: section.title.slice(0, 200),
            description: (section.description ?? '').slice(0, 5000),
            color,
            sectionType: color,
            componentKey,
            status: (section.status ?? 'draft') as WebsitePlanningStatus,
          };

          if (componentKey) componentSections.set(componentKey, mapped);
          return mapped;
        });

      return {
        id: createPlanningId(),
        title: page.title.slice(0, 200),
        slug:
          slugifyPageTitle(page.slug ?? page.title) ||
          slugifyPageTitle(page.title),
        sections,
        description: (page.description ?? '').slice(0, 2000),
        pageType: asPageType(page.pageType),
        status: (page.status ?? 'draft') as WebsitePlanningStatus,
        parentId: null,
        seoIntent: (page.seoIntent ?? '').slice(0, 500),
        _parentSlug:
          typeof page.parentSlug === 'string' ? page.parentSlug : null,
      };
    });

  const allForParents = [
    ...(options?.existingPages ?? []),
    ...newPages,
  ];
  const bySlug = new Map(allForParents.map((page) => [page.slug, page.id]));

  return newPages.map((page) => {
    const { _parentSlug, ...rest } = page;
    if (_parentSlug) {
      const parentId = bySlug.get(slugifyPageTitle(_parentSlug));
      if (parentId && parentId !== page.id) {
        return { ...rest, parentId };
      }
    }
    return rest;
  });
}

export function materialiseAiWireframeSections(params: {
  sitemapSections: Array<{ id: string; title: string; description: string }>;
  rawSections: AiWireframeSection[];
  /** When regenerating one section, pass the existing wireframe section id. */
  existingBySitemapSectionId?: Map<string, WebsiteWireframeSection>;
}): WebsiteWireframeSection[] {
  const { sitemapSections, rawSections, existingBySitemapSectionId } = params;

  return sitemapSections.map((sitemapSection, index) => {
    const match =
      rawSections.find(
        (raw) =>
          raw.sitemapSectionTitle?.trim().toLowerCase() ===
          sitemapSection.title.trim().toLowerCase(),
      ) ?? rawSections[index];

        const library = findSectionLibraryEntry(match?.libraryKey ?? null);
        const layoutFromAi =
          asLayout(match?.layoutPreset) ?? asLayout(match?.layout);
        const presetCandidate = match?.layoutPreset?.trim();
        const layoutPreset: WebsiteLayoutPreset | null =
          (presetCandidate &&
          (SITE_BLOCK_LAYOUT_PRESETS as readonly string[]).includes(
            presetCandidate,
          )
            ? (presetCandidate as WebsiteLayoutPreset)
            : null) ??
          (library?.key
            ? (LEGACY_LIBRARY_KEY_TO_PRESET[library.key] ?? null)
            : null) ??
          existingBySitemapSectionId?.get(sitemapSection.id)?.layoutPreset ??
          null;

        const existing = existingBySitemapSectionId?.get(sitemapSection.id);

        const section: WebsiteWireframeSection = {
          id: existing?.id ?? createPlanningId(),
          sitemapSectionId: sitemapSection.id,
          title: String(match?.title ?? sitemapSection.title).slice(0, 200),
          layout: layoutFromAi ?? library?.layout ?? existing?.layout ?? 'full',
          libraryKey: library?.key ?? existing?.libraryKey ?? null,
          layoutPreset,
          copyOutline: formatCopyOutline(match?.copyOutline),
          contentNotes: String(
            match?.contentNotes ??
              existing?.contentNotes ??
              sitemapSection.description,
          ).slice(0, 10000),
          copy: existing?.copy,
          clientComment: existing?.clientComment,
        };

    const seeded = ensureWireframeCopy(section);
    const outlineSlots = outlineToSlots(match?.copyOutline);
    for (const [key, value] of Object.entries(outlineSlots)) {
      if (value.trim()) seeded.slots[key] = value.slice(0, 10000);
    }

    const aiSlots = match?.copy?.slots;
    if (aiSlots && typeof aiSlots === 'object') {
      for (const [key, value] of Object.entries(aiSlots)) {
        if (typeof value === 'string' && value.trim()) {
          seeded.slots[key] = value.slice(0, 10000);
        }
      }
    }

    const aiItems = match?.copy?.items;
    if (Array.isArray(aiItems) && aiItems.length > 0 && seeded.items) {
      seeded.items = seeded.items.map((item, itemIndex) => {
        const rawItem = aiItems[itemIndex];
        if (!rawItem?.slots) return item;
        const nextSlots = { ...item.slots };
        for (const [key, value] of Object.entries(rawItem.slots)) {
          if (typeof value === 'string' && value.trim()) {
            nextSlots[key] = value.slice(0, 10000);
          }
        }
        return { ...item, slots: nextSlots };
      });
    }

    const copy: WebsiteWireframeCopy = seeded;
    return { ...section, copy };
  });
}
