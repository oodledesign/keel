import { z } from 'zod';

const WebsiteIdFields = {
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
};

const BriefServiceSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(200),
  description: z.string().max(5000),
});

const BriefAudienceSegmentSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(200),
  jobsToBeDone: z.string().max(5000),
  objections: z.array(z.string().max(1000)).max(20),
});

const BriefCompetitorSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(200),
  url: z.string().max(500),
  notes: z.string().max(2000),
});

const BriefReferenceSchema = z.object({
  id: z.string().max(80).optional(),
  url: z.string().max(500),
  whyThisWorks: z.string().max(1000),
});

export const WebsiteBriefSchema = z.object({
  schemaVersion: z.literal('1.0'),
  org: z.object({
    name: z.string().max(200),
    oneLiner: z.string().max(500),
    sector: z.string().max(200),
    geography: z.string().max(1000),
  }),
  brand: z.object({
    tone: z.array(z.string().max(100)).max(20),
    constraints: z.array(z.string().max(500)).max(30),
    existingSiteUrl: z.string().max(500).optional(),
  }),
  offer: z.object({
    services: z.array(BriefServiceSchema).max(30),
    primaryConversionGoals: z.array(z.string().max(500)).max(20),
  }),
  audience: z.object({
    segments: z.array(BriefAudienceSegmentSchema).max(20),
  }),
  conversation: z.object({
    questionsTheSiteMustAnswer: z.array(z.string().max(500)).max(30),
  }),
  competitors: z.array(BriefCompetitorSchema).max(20),
  references: z.array(BriefReferenceSchema).max(20),
  stackPreference: z.enum([
    'webflow',
    'astro',
    'next',
    'ozer_sites',
    'undecided',
  ]),
});

/** Sparse nested patch for autosave delta updates. */
export const WebsiteBriefPatchSchema = z
  .object({
    org: z
      .object({
        name: z.string().max(200).optional(),
        oneLiner: z.string().max(500).optional(),
        sector: z.string().max(200).optional(),
        geography: z.string().max(1000).optional(),
      })
      .optional(),
    brand: z
      .object({
        tone: z.array(z.string().max(100)).max(20).optional(),
        constraints: z.array(z.string().max(500)).max(30).optional(),
        existingSiteUrl: z.string().max(500).optional(),
      })
      .optional(),
    offer: z
      .object({
        services: z.array(BriefServiceSchema).max(30).optional(),
        primaryConversionGoals: z
          .array(z.string().max(500))
          .max(20)
          .optional(),
      })
      .optional(),
    audience: z
      .object({
        segments: z.array(BriefAudienceSegmentSchema).max(20).optional(),
      })
      .optional(),
    conversation: z
      .object({
        questionsTheSiteMustAnswer: z
          .array(z.string().max(500))
          .max(30)
          .optional(),
      })
      .optional(),
    competitors: z.array(BriefCompetitorSchema).max(20).optional(),
    references: z.array(BriefReferenceSchema).max(20).optional(),
    stackPreference: z
      .enum(['webflow', 'astro', 'next', 'ozer_sites', 'undecided'])
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch must include at least one field',
  });

export const SaveWebsiteBriefSchema = z.object({
  ...WebsiteIdFields,
  brief: WebsiteBriefSchema,
});

export const PatchWebsiteBriefSchema = z.object({
  ...WebsiteIdFields,
  patch: WebsiteBriefPatchSchema,
  /** Field paths the user edited — mark human_edited in ai_provenance. */
  editedPaths: z.array(z.string().max(80)).max(40).optional(),
});

export const ConfirmWebsiteBriefAiSchema = z.object({
  ...WebsiteIdFields,
  paths: z.array(z.string().max(80)).min(1).max(40),
});

export const SuggestWebsiteBriefSchema = z.object({
  ...WebsiteIdFields,
  source: z.enum(['notes', 'url', 'crm']),
  notes: z.string().max(20000).optional(),
  websiteUrl: z
    .string()
    .max(500)
    .refine(
      (value) => {
        try {
          const url = new URL(
            /^https?:\/\//i.test(value) ? value : `https://${value}`,
          );
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid http(s) URL' },
    )
    .optional(),
  /** Human-owned field paths the user confirmed AI may overwrite. */
  confirmOverwritePaths: z.array(z.string().max(80)).max(40).optional(),
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
  /** Absolute expiry ISO string, or null for no expiry. */
  expiresAt: z.string().datetime().nullable().optional(),
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
