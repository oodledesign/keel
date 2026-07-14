import { z } from 'zod';

const WebsiteIdFields = {
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
};

const PlanningStatusSchema = z.enum(['draft', 'approved', 'blocked']);

const PageTypeSchema = z.enum([
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

const SectionTypeSchema = z.enum([
  'nav',
  'hero',
  'proof',
  'conversion',
  'content',
  'footer',
  'other',
]);

const SitemapSectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  color: SectionTypeSchema.optional(),
  sectionType: SectionTypeSchema.optional(),
  componentKey: z.string().max(100).nullable().optional(),
  status: PlanningStatusSchema.optional(),
});

const SitemapPageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  sections: z.array(SitemapSectionSchema),
  description: z.string().max(2000).optional(),
  pageType: PageTypeSchema.optional(),
  status: PlanningStatusSchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  seoIntent: z.string().max(500).optional(),
  approvalNote: z.string().max(2000).optional(),
});

const SitemapSymbolSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  color: SectionTypeSchema,
  status: PlanningStatusSchema,
});

const SitemapDocumentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  pages: z.array(SitemapPageSchema),
  components: z.array(SitemapSymbolSchema),
});

const WireframeCopyItemSchema = z.object({
  id: z.string().uuid(),
  slots: z.record(z.string(), z.string().max(10000)),
});

const WireframeCopySchema = z.object({
  slots: z.record(z.string(), z.string().max(10000)),
  items: z.array(WireframeCopyItemSchema).optional(),
});

const WireframeSectionSchema = z.object({
  id: z.string().uuid(),
  sitemapSectionId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  layout: z.enum(['full', 'split', 'grid', 'cards', 'cta', 'footer']),
  contentNotes: z.string().max(10000),
  libraryKey: z.string().max(100).nullable().optional(),
  layoutPreset: z
    .enum([
      'header',
      'hero-split',
      'hero-centered',
      'hero-form',
      'logo-cloud',
      'feature-grid',
      'feature-alternating',
      'testimonials',
      'stats-bar',
      'pricing-table',
      'team-grid',
      'faq-accordion',
      'cta-band',
      'contact-form',
      'map-section',
      'blog-grid',
      'content-prose',
      'gallery-grid',
      'footer',
    ])
    .nullable()
    .optional(),
  copyOutline: z.string().max(10000).optional(),
  copy: WireframeCopySchema.optional(),
  clientComment: z.string().max(2000).optional(),
});

const WireframePageSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  title: z.string().min(1).max(200),
  sections: z.array(WireframeSectionSchema),
});

export const GetWebsitePlanningSchema = z.object({ ...WebsiteIdFields });

export const SaveWebsiteSitemapSchema = z.object({
  ...WebsiteIdFields,
  /** Document (v1) or legacy page array — server migrates to document on write. */
  sitemap: z.union([SitemapDocumentSchema, z.array(SitemapPageSchema)]),
});

export const SaveWebsiteWireframesSchema = z.object({
  ...WebsiteIdFields,
  wireframes: z.array(WireframePageSchema),
});

export const LinkWebsiteJobSchema = z.object({
  ...WebsiteIdFields,
  jobId: z.string().uuid().nullable(),
});

export const CreateWebsiteContentDocSchema = z.object({
  ...WebsiteIdFields,
  title: z.string().max(200).optional(),
});

export const UpdateWebsiteContentDocSchema = z.object({
  ...WebsiteIdFields,
  docId: z.string().uuid(),
  title: z.string().max(200).optional(),
  contentMd: z.string().max(200000).optional(),
});

export const DeleteWebsiteContentDocSchema = z.object({
  ...WebsiteIdFields,
  docId: z.string().uuid(),
});

export const GetWebsiteForJobSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export {
  SitemapPageSchema,
  SitemapDocumentSchema,
  SitemapSymbolSchema,
  WireframePageSchema,
};
