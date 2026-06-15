import { z } from 'zod';

const WebsiteIdFields = {
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
};

const SitemapSectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
});

const SitemapPageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  sections: z.array(SitemapSectionSchema),
});

const WireframeSectionSchema = z.object({
  id: z.string().uuid(),
  sitemapSectionId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  layout: z.enum(['full', 'split', 'grid', 'cards', 'cta', 'footer']),
  contentNotes: z.string().max(10000),
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
  sitemap: z.array(SitemapPageSchema),
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
