import { z } from 'zod';

const WebsiteIdFields = {
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
};

const BriefReferenceSchema = z.object({
  url: z.string().max(500),
  why: z.string().max(1000),
});

export const WebsiteBriefSchema = z.object({
  orgName: z.string().max(200),
  brandSummary: z.string().max(5000),
  offer: z.string().max(5000),
  audience: z.string().max(5000),
  geography: z.string().max(1000),
  jobsToBeDone: z.string().max(5000),
  objections: z.string().max(5000),
  competitors: z.string().max(5000),
  references: z.array(BriefReferenceSchema).max(10),
  tone: z.string().max(2000),
  constraints: z.string().max(5000),
  conversionGoals: z.string().max(5000),
  targetStack: z.enum(['webflow', 'astro', 'next', 'undecided']),
  cmsNeeded: z.boolean(),
});

export const SaveWebsiteBriefSchema = z.object({
  ...WebsiteIdFields,
  brief: WebsiteBriefSchema,
});

export const SuggestWebsiteBriefSchema = z.object({
  ...WebsiteIdFields,
  notes: z.string().max(20000).optional(),
  websiteUrl: z.string().max(500).optional(),
});

export const GenerateWebsiteSitemapSchema = z.object({
  ...WebsiteIdFields,
  mode: z.enum(['replace', 'add-missing-seo-pages']).default('replace'),
});

export const GenerateWebsiteWireframesSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

const StyleTokensSchema = z.object({
  canvas: z.string().max(50),
  atmosphere: z.string().max(50),
  accent: z.string().max(50),
  contrast: z.string().max(50),
  secondary: z.string().max(50),
  headingFont: z.string().max(100),
  bodyFont: z.string().max(100),
  typeScale: z.enum(['compact', 'regular', 'display']),
  radius: z.enum(['sharp', 'soft', 'round']),
  spacingDensity: z.enum(['tight', 'regular', 'airy']),
  photographyDirection: z.string().max(2000),
});

const MoodboardRefSchema = z.object({
  url: z.string().max(500),
  note: z.string().max(1000),
});

export const WebsiteStyleSystemSchema = z.object({
  tokens: StyleTokensSchema,
  moodboard: z.array(MoodboardRefSchema).max(20),
  locked: z.boolean(),
});

export const SaveWebsiteStyleSystemSchema = z.object({
  ...WebsiteIdFields,
  style: WebsiteStyleSystemSchema,
});

export const SuggestWebsiteStyleSchema = z.object({ ...WebsiteIdFields });

const AnswerBlockSchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(5000),
});

export const WebsiteSeoPageFieldsSchema = z.object({
  primaryKeyword: z.string().max(200),
  secondaryKeywords: z.string().max(2000),
  title: z.string().max(200),
  metaDescription: z.string().max(500),
  h1: z.string().max(300),
  headingOutline: z.string().max(10000),
  internalLinks: z.string().max(5000),
  canonicalNotes: z.string().max(2000),
  imageAltPlan: z.string().max(5000),
  schemaTypes: z.array(z.string().max(100)).max(10),
  localSeo: z.string().max(5000),
  answerBlocks: z.array(AnswerBlockSchema).max(20),
  entityNotes: z.string().max(5000),
});

export const SaveWebsiteSeoPageSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
  fields: WebsiteSeoPageFieldsSchema,
});

export const GenerateWebsiteSeoPageSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

export const GetSiteStudioBundleSchema = z.object({ ...WebsiteIdFields });

export const CreateWebsiteShareSchema = z.object({
  ...WebsiteIdFields,
  scope: z.enum(['sitemap', 'wireframes', 'design', 'full']),
});

export const RevokeWebsiteShareSchema = z.object({
  ...WebsiteIdFields,
  shareId: z.string().uuid(),
});

export const SetWebsitePortalScopeSchema = z.object({
  ...WebsiteIdFields,
  scope: z.enum(['off', 'sitemap', 'wireframes', 'full']),
});

export const CreateWebsiteProjectSchema = z.object({
  ...WebsiteIdFields,
  existingJobId: z.string().uuid().optional(),
});

export const SetShareApprovalSchema = z.object({
  token: z.string().min(16).max(200),
  pageId: z.string().uuid(),
  status: z.enum(['approved', 'blocked']),
  note: z.string().max(2000).optional(),
});

export const SetShareSectionCommentSchema = z.object({
  token: z.string().min(16).max(200),
  pageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  comment: z.string().max(2000),
});
