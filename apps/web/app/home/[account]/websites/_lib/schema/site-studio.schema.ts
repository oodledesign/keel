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
        primaryConversionGoals: z.array(z.string().max(500)).max(20).optional(),
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
  mode: z
    .enum([
      'from-brief',
      'add-missing-seo-pages',
      'local-service-variants',
      // Legacy aliases
      'replace',
    ])
    .default('from-brief'),
});

export const ProposeWebsiteSitemapSchema = GenerateWebsiteSitemapSchema;

export const GenerateWebsiteWireframesSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

export const ProposeWebsiteWireframesSchema = GenerateWebsiteWireframesSchema;

export const ProposeWebsiteWireframeSectionSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

const StyleTokensSchema = z.object({
  schemaVersion: z.literal('1.0'),
  colors: z.object({
    primary: z.string().max(50),
    secondary: z.string().max(50),
    accent: z.string().max(50),
    neutrals: z.array(z.string().max(50)).min(5).max(7),
    success: z.string().max(50),
    warning: z.string().max(50),
    danger: z.string().max(50),
  }),
  typography: z.object({
    displayFamily: z.string().max(100),
    bodyFamily: z.string().max(100),
    typeScale: z.object({
      base: z.number().min(12).max(24),
      ratio: z.number().min(1.1).max(1.6),
    }),
    weights: z.object({
      regular: z.number().int().min(100).max(900),
      medium: z.number().int().min(100).max(900),
      bold: z.number().int().min(100).max(900),
    }),
    headings: z
      .object({
        h1: z
          .object({
            sizePx: z.number().min(10).max(120).nullable().optional(),
            weight: z.number().int().min(100).max(900).nullable().optional(),
          })
          .default({}),
        h2: z
          .object({
            sizePx: z.number().min(10).max(120).nullable().optional(),
            weight: z.number().int().min(100).max(900).nullable().optional(),
          })
          .default({}),
        h3: z
          .object({
            sizePx: z.number().min(10).max(120).nullable().optional(),
            weight: z.number().int().min(100).max(900).nullable().optional(),
          })
          .default({}),
      })
      .default({ h1: {}, h2: {}, h3: {} }),
  }),
  radius: z.object({
    none: z.string().max(40),
    sm: z.string().max(40),
    md: z.string().max(40),
    lg: z.string().max(40),
    full: z.string().max(40),
  }),
  spacingDensity: z.enum(['compact', 'comfortable', 'spacious']),
  photographyDirection: z.string().max(2000),
  buttons: z.object({
    style: z.enum(['pill', 'rounded', 'square']),
  }),
});

const MoodboardRefSchema = z.object({
  url: z.string().max(500),
  note: z.string().max(1000),
  imageRefs: z.array(z.string().max(500)).max(20).optional(),
  extractedPalette: z.array(z.string().max(50)).max(12).optional(),
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
  draftAnswer: z.string().max(5000),
});

const HeadingOutlineItemSchema = z.object({
  level: z.number().int().min(1).max(6),
  text: z.string().max(500),
});

const InternalLinkSchema = z.object({
  toSlug: z.string().max(200),
  anchorSuggestion: z.string().max(300),
});

const ImageAltSchema = z.object({
  imageRole: z.string().max(200),
  altPattern: z.string().max(500),
});

export const WebsiteSeoPageSeoSchema = z.object({
  schemaVersion: z.literal('1.0').or(z.string().max(20)).optional(),
  keywords: z.object({
    primary: z.string().max(200),
    secondary: z.array(z.string().max(200)).max(20),
  }),
  meta: z.object({
    title: z.string().max(200),
    description: z.string().max(500),
  }),
  headingOutline: z.array(HeadingOutlineItemSchema).max(40),
  internalLinks: z.array(InternalLinkSchema).max(40),
  canonicalRule: z.string().max(2000),
  slugRule: z.string().max(500),
  imageAltPlan: z.array(ImageAltSchema).max(40),
  schemaTypes: z.array(z.string().max(100)).max(12),
  geo: z.object({
    isLocationPage: z.boolean(),
    nap: z.string().max(2000),
    serviceArea: z.array(z.string().max(200)).max(40),
    gbpCues: z.array(z.string().max(300)).max(40),
    localFaq: z.array(AnswerBlockSchema).max(20),
  }),
  aeo: z.object({
    answerBlocks: z.array(AnswerBlockSchema).max(20),
    definitions: z.array(z.string().max(500)).max(20),
    entityNotes: z.string().max(5000),
  }),
  technical: z.object({
    indexable: z.boolean(),
    ogImagePlan: z.string().max(2000),
  }),
});

/** @deprecated Prefer WebsiteSeoPageSeoSchema */
export const WebsiteSeoPageFieldsSchema = WebsiteSeoPageSeoSchema;

export const SaveWebsiteSeoPageSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
  pageSlug: z.string().min(1).max(200).optional(),
  seo: WebsiteSeoPageSeoSchema,
  status: z.enum(['draft', 'approved']).optional(),
});

export const ApproveWebsiteSeoPageSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

export const ProposeWebsiteSeoPageSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

export const DraftWebsiteSeoAnswerBlocksSchema = z.object({
  ...WebsiteIdFields,
  pageId: z.string().uuid(),
});

/** @deprecated Prefer ProposeWebsiteSeoPageSchema (preview-then-apply). */
export const GenerateWebsiteSeoPageSchema = ProposeWebsiteSeoPageSchema;

export const GetSiteStudioBundleSchema = z.object({ ...WebsiteIdFields });

/** Authenticated in-app SiteStudioExport document. */
export const GetWebsiteExportSchema = z.object({ ...WebsiteIdFields });

export const GeneratePromptPackSchema = z.object({
  ...WebsiteIdFields,
  target: z.enum(['webflow', 'astro', 'next', 'ozer_sites']),
});

/** Contract-backed Webflow / Astro / Next scaffold zip (Prompts D2 + E3). */
export const GenerateScaffoldPackSchema = z.object({
  ...WebsiteIdFields,
  kind: z.enum(['webflow', 'astro', 'next']),
});

export const SaveWebsiteLlmsTxtSchema = z.object({
  ...WebsiteIdFields,
  llmsTxt: z.string().max(50_000),
});

export const PreviewWebsiteLlmsTxtSchema = z.object({
  ...WebsiteIdFields,
});

/** Figma Tier 0 zip + Tier 1 chrome-less import URLs (Prompt D3). */
export const GenerateFigmaPackSchema = z.object({
  ...WebsiteIdFields,
  /** Attempt Playwright PNG capture when Chromium is available. Default true. */
  capturePngs: z.boolean().optional(),
});

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

export const SetShareApprovalSchema = z
  .object({
    token: z.string().min(16).max(200),
    targetType: z.enum(['page', 'section']),
    targetId: z.string().uuid(),
    /** Parent page for section approvals. */
    pageId: z.string().uuid().optional(),
    status: z.enum(['approved', 'blocked']),
    note: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'section' && !value.pageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pageId is required for section approvals',
        path: ['pageId'],
      });
    }
  });

export const SetPortalWebsiteApprovalSchema = z
  .object({
    clientOrgId: z.string().uuid(),
    websiteId: z.string().uuid(),
    targetType: z.enum(['page', 'section']),
    targetId: z.string().uuid(),
    pageId: z.string().uuid().optional(),
    status: z.enum(['approved', 'blocked']),
    note: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'section' && !value.pageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pageId is required for section approvals',
        path: ['pageId'],
      });
    }
  });

export const ListWebsiteApprovalsSchema = z.object({
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
});

export const SetShareSectionCommentSchema = z.object({
  token: z.string().min(16).max(200),
  pageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  comment: z.string().max(2000),
});

/* Ozer Sites (F1 / F2) */
export const PublishOzerSitesSchema = z.object({
  ...WebsiteIdFields,
  subdomain: z
    .string()
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  resolveConflicts: z
    .record(z.string().uuid(), z.enum(['overwrite', 'skip']))
    .optional(),
});

export const GetOzerSiteBundleSchema = z.object({
  ...WebsiteIdFields,
  clientOrgId: z.string().uuid().optional(),
});

export const SaveOzerSitePageDraftSchema = z.object({
  accountId: z.string().uuid(),
  pageId: z.string().uuid(),
  puckData: z.record(z.string(), z.unknown()),
  title: z.string().max(300).optional(),
  asHumanEdit: z.boolean().optional(),
  /** Portal client edit path */
  clientOrgId: z.string().uuid().optional(),
});

export const PublishOzerSitePageSchema = z.object({
  accountId: z.string().uuid(),
  pageId: z.string().uuid(),
  clientOrgId: z.string().uuid().optional(),
});

export const UpdateOzerSiteSettingsSchema = z.object({
  accountId: z.string().uuid(),
  siteId: z.string().uuid(),
  settings: z.object({
    portalEditEnabled: z.boolean().optional(),
    clientCanDelete: z.boolean().optional(),
    clientCanInsert: z.boolean().optional(),
    clientCanDrag: z.boolean().optional(),
  }),
});
