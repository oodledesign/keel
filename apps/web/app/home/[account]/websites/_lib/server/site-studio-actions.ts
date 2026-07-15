'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { normalizeWebsiteBrief } from '~/lib/websites/brief-types';
import { buildExport } from '~/lib/websites/export-contract';
import {
  astroPackZipFilename,
  generateAstroPack,
} from '~/lib/websites/exporters/astro-pack';
import {
  figmaPackZipFilename,
  generateFigmaPack,
} from '~/lib/websites/exporters/figma-pack';
import {
  generateNextPack,
  nextPackZipFilename,
} from '~/lib/websites/exporters/next-pack';
import { generatePromptPack } from '~/lib/websites/exporters/prompt-pack';
import { generateLlmsTxt } from '~/lib/websites/exporters/seo-generators';
import {
  generateWebflowPack,
  webflowPackZipFilename,
} from '~/lib/websites/exporters/webflow-pack';
import {
  zipPackToBase64,
  zipPromptPackToBase64,
} from '~/lib/websites/exporters/zip-pack';
import type { SitemapProposeMode } from '~/lib/websites/site-studio-ai-types';

import {
  ApproveWebsiteSeoPageSchema,
  ConfirmWebsiteBriefAiSchema,
  CreateWebsiteProjectSchema,
  CreateWebsiteShareSchema,
  DraftWebsiteSeoAnswerBlocksSchema,
  GenerateFigmaPackSchema,
  GeneratePromptPackSchema,
  GenerateScaffoldPackSchema,
  GenerateWebsiteSeoPageSchema,
  GenerateWebsiteSitemapSchema,
  GenerateWebsiteWireframesSchema,
  GetSiteStudioBundleSchema,
  GetWebsiteExportSchema,
  ListWebsiteApprovalsSchema,
  PatchWebsiteBriefSchema,
  PreviewWebsiteLlmsTxtSchema,
  ProposeWebsiteSeoPageSchema,
  ProposeWebsiteSitemapSchema,
  ProposeWebsiteWireframeSectionSchema,
  ProposeWebsiteWireframesSchema,
  RevokeWebsiteShareSchema,
  SaveWebsiteBriefSchema,
  SaveWebsiteLlmsTxtSchema,
  SaveWebsiteSeoPageSchema,
  SaveWebsiteStyleSystemSchema,
  SetPortalWebsiteApprovalSchema,
  SetShareApprovalSchema,
  SetShareSectionCommentSchema,
  SetWebsitePortalScopeSchema,
  SuggestWebsiteBriefSchema,
  SuggestWebsiteStyleSchema,
} from '../schema/site-studio.schema';
import {
  createSiteStudioService,
  setShareSectionCommentByToken,
  websiteShareFigmaPageUrl,
} from './site-studio.service';
import {
  createWebsiteApprovalsService,
  setPortalWebsiteApproval,
  setShareApprovalByToken,
} from './website-approvals.service';
import { createWebsitePlanningService } from './website-planning.service';
import { createWebsitesService } from './websites.service';

function getService() {
  return createSiteStudioService(getSupabaseServerClient());
}

async function seoPackOptions(accountId: string, websiteId: string) {
  const bundle = await getService().getBundle(accountId, websiteId);
  return {
    llmsTxtOverride: bundle.llmsTxt,
  };
}

export const getSiteStudioBundle = enhanceAction(
  async (input) => getService().getBundle(input.accountId, input.websiteId),
  { schema: GetSiteStudioBundleSchema },
);

/**
 * Authenticated SiteStudioExport for in-app consumers (pack UI, downloads).
 * Public/token consumers use GET /api/websites/export?token=…
 */
export const getWebsiteExport = enhanceAction(
  async (input) => {
    const website = await createWebsitesService(
      getSupabaseServerClient(),
    ).getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!website) throw new Error('Website not found');
    return buildExport(input.websiteId);
  },
  { schema: GetWebsiteExportSchema },
);

/**
 * Build Cursor/Claude prompt pack from SiteStudioExport and return files + zip.
 * Zip assembly is server-side (fflate). Generator never hits the database.
 */
export const generateWebsitePromptPack = enhanceAction(
  async (input) => {
    const website = await createWebsitesService(
      getSupabaseServerClient(),
    ).getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!website) throw new Error('Website not found');

    const exp = await buildExport(input.websiteId);
    const options = await seoPackOptions(input.accountId, input.websiteId);
    const pack = generatePromptPack(exp, input.target, options);
    const zipBase64 = zipPromptPackToBase64(pack.files);
    const slug =
      website.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'website';

    return {
      target: input.target,
      files: pack.files,
      zipBase64,
      zipFilename: `${slug}-prompt-pack-${input.target}.zip`,
    };
  },
  { schema: GeneratePromptPackSchema },
);

/**
 * Build Webflow Client-First or Astro starter from SiteStudioExport (server zip).
 * Generators never hit the database — only buildExport loads sources.
 */
export const generateWebsiteScaffoldPack = enhanceAction(
  async (input) => {
    const website = await createWebsitesService(
      getSupabaseServerClient(),
    ).getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!website) throw new Error('Website not found');

    const exp = await buildExport(input.websiteId);
    const name = website.name || exp.website.name || 'website';
    const options = await seoPackOptions(input.accountId, input.websiteId);

    if (input.kind === 'webflow') {
      const pack = generateWebflowPack(exp, options);
      return {
        kind: 'webflow' as const,
        files: pack.files,
        zipBase64: zipPackToBase64(pack.files),
        zipFilename: webflowPackZipFilename(name),
      };
    }

    if (input.kind === 'next') {
      const pack = generateNextPack(exp, options);
      return {
        kind: 'next' as const,
        files: pack.files,
        zipBase64: zipPackToBase64(pack.files),
        zipFilename: nextPackZipFilename(name),
      };
    }

    const pack = generateAstroPack(exp, options);
    return {
      kind: 'astro' as const,
      files: pack.files,
      zipBase64: zipPackToBase64(pack.files),
      zipFilename: astroPackZipFilename(name),
    };
  },
  { schema: GenerateScaffoldPackSchema },
);

/**
 * Figma Tier 0 zip (tokens + outline + optional PNGs) and Tier 1 import URLs.
 * Ensures a wireframes-capable share token for chrome-less html.to.design pages.
 */
export const generateWebsiteFigmaPack = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const website = await createWebsitesService(client).getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!website) throw new Error('Website not found');

    const service = createSiteStudioService(client);
    const share = await service.ensureWireframesShareForFigma(
      input.accountId,
      input.websiteId,
    );

    const exp = await buildExport(input.websiteId);
    const name = website.name || exp.website.name || 'website';

    const importUrls: Record<string, string> = {};
    for (const page of exp.sitemap) {
      importUrls[page.slug] = websiteShareFigmaPageUrl(share.token, page.slug);
    }

    const shouldCapture = input.capturePngs !== false;
    let pagePngs: Record<string, Uint8Array> = {};
    let pngNotes: string[] = [];
    if (shouldCapture && Object.keys(importUrls).length > 0) {
      // Lazy-load so Playwright stays out of the server-actions webpack graph.
      const { captureFigmaWireframePngMap } =
        await import('~/lib/websites/exporters/figma-screenshots');
      const capture = await captureFigmaWireframePngMap(importUrls);
      pagePngs = capture.pagePngs;
      pngNotes = capture.notes;
    }

    const pack = generateFigmaPack(exp, { importUrls, pagePngs });
    const previewFiles = pack.files.map((file) => ({
      path: file.path,
      content:
        typeof file.content === 'string'
          ? file.content
          : `[binary PNG · ${file.content.byteLength} bytes — use Download .zip]`,
    }));

    return {
      files: previewFiles,
      zipBase64: zipPackToBase64(pack.files),
      zipFilename: figmaPackZipFilename(name),
      shareToken: share.token,
      shareUrl: share.url,
      pages: exp.sitemap.map((page) => ({
        slug: page.slug,
        title: page.title,
        importUrl: importUrls[page.slug]!,
      })),
      pngNotes,
    };
  },
  { schema: GenerateFigmaPackSchema },
);

export const saveWebsiteBrief = enhanceAction(
  async (input) =>
    getService().saveBrief(
      input.accountId,
      input.websiteId,
      normalizeWebsiteBrief(input.brief),
    ),
  { schema: SaveWebsiteBriefSchema },
);

export const patchWebsiteBrief = enhanceAction(
  async (input) =>
    getService().patchBrief(
      input.accountId,
      input.websiteId,
      input.patch,
      input.editedPaths ?? [],
    ),
  { schema: PatchWebsiteBriefSchema },
);

export const confirmWebsiteBriefAi = enhanceAction(
  async (input) =>
    getService().confirmBriefAiFields(
      input.accountId,
      input.websiteId,
      input.paths,
    ),
  { schema: ConfirmWebsiteBriefAiSchema },
);

export const suggestWebsiteBrief = enhanceAction(
  async (input) =>
    getService().suggestBrief(input.accountId, input.websiteId, {
      source: input.source,
      notes: input.notes,
      websiteUrl: input.websiteUrl,
      confirmOverwritePaths: input.confirmOverwritePaths,
    }),
  { schema: SuggestWebsiteBriefSchema },
);

export const proposeWebsiteSitemap = enhanceAction(
  async (input) => {
    const mode: SitemapProposeMode =
      input.mode === 'replace' ? 'from-brief' : input.mode;
    return getService().proposeSitemap(input.accountId, input.websiteId, mode);
  },
  { schema: ProposeWebsiteSitemapSchema },
);

/** @deprecated Prefer proposeWebsiteSitemap — does not persist. */
export const generateWebsiteSitemap = enhanceAction(
  async (input) => {
    const mode: SitemapProposeMode =
      input.mode === 'replace' ? 'from-brief' : input.mode;
    const proposal = await getService().proposeSitemap(
      input.accountId,
      input.websiteId,
      mode,
    );
    return proposal.pages;
  },
  { schema: GenerateWebsiteSitemapSchema },
);

export const proposeWebsiteWireframes = enhanceAction(
  async (input) =>
    getService().proposeWireframesForPage(
      input.accountId,
      input.websiteId,
      input.pageId,
    ),
  { schema: ProposeWebsiteWireframesSchema },
);

export const proposeWebsiteWireframeSection = enhanceAction(
  async (input) =>
    getService().proposeWireframeSection(
      input.accountId,
      input.websiteId,
      input.pageId,
      input.sectionId,
    ),
  { schema: ProposeWebsiteWireframeSectionSchema },
);

/** @deprecated Prefer proposeWebsiteWireframes — does not persist. */
export const generateWebsiteWireframes = enhanceAction(
  async (input) =>
    getService().generateWireframesForPage(
      input.accountId,
      input.websiteId,
      input.pageId,
    ),
  { schema: GenerateWebsiteWireframesSchema },
);

export const saveWebsiteStyleSystem = enhanceAction(
  async (input) =>
    getService().saveStyleSystem(input.accountId, input.websiteId, input.style),
  { schema: SaveWebsiteStyleSystemSchema },
);

export const suggestWebsiteStyle = enhanceAction(
  async (input) => getService().suggestStyle(input.accountId, input.websiteId),
  { schema: SuggestWebsiteStyleSchema },
);

/** Site-level llms.txt override (Prompt E2 edit-before-export). */
export const saveWebsiteLlmsTxt = enhanceAction(
  async (input) =>
    getService().saveLlmsTxt(input.accountId, input.websiteId, input.llmsTxt),
  { schema: SaveWebsiteLlmsTxtSchema },
);

/** Regenerated draft from current SiteStudioExport (ignores saved override). */
export const previewWebsiteLlmsTxt = enhanceAction(
  async (input) => {
    const website = await createWebsitesService(
      getSupabaseServerClient(),
    ).getWebsite({
      accountId: input.accountId,
      websiteId: input.websiteId,
    });
    if (!website) throw new Error('Website not found');
    const exp = await buildExport(input.websiteId);
    return { llmsTxt: generateLlmsTxt(exp) };
  },
  { schema: PreviewWebsiteLlmsTxtSchema },
);

export const saveWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().saveSeoPage(
      input.accountId,
      input.websiteId,
      input.pageId,
      input.seo,
      { pageSlug: input.pageSlug, status: input.status },
    ),
  { schema: SaveWebsiteSeoPageSchema },
);

export const approveWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().approveSeoPage(input.accountId, input.websiteId, input.pageId),
  { schema: ApproveWebsiteSeoPageSchema },
);

/** Preview-only search plan (does not persist). */
export const proposeWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().proposeSeoPage(input.accountId, input.websiteId, input.pageId),
  { schema: ProposeWebsiteSeoPageSchema },
);

/** Preview-only AEO answer blocks (Haiku). */
export const draftWebsiteSeoAnswerBlocks = enhanceAction(
  async (input) =>
    getService().draftSeoAnswerBlocks(
      input.accountId,
      input.websiteId,
      input.pageId,
    ),
  { schema: DraftWebsiteSeoAnswerBlocksSchema },
);

/** @deprecated Prefer proposeWebsiteSeoPage + saveWebsiteSeoPage. */
export const generateWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().generateSeoPage(
      input.accountId,
      input.websiteId,
      input.pageId,
    ),
  { schema: GenerateWebsiteSeoPageSchema },
);

export const createWebsiteShare = enhanceAction(
  async (input) =>
    getService().createShare(
      input.accountId,
      input.websiteId,
      input.scope,
      input.expiresAt ?? null,
    ),
  { schema: CreateWebsiteShareSchema },
);

export const revokeWebsiteShare = enhanceAction(
  async (input) =>
    getService().revokeShare(input.accountId, input.websiteId, input.shareId),
  { schema: RevokeWebsiteShareSchema },
);

export const setWebsitePortalScope = enhanceAction(
  async (input) =>
    getService().setPortalScope(input.accountId, input.websiteId, input.scope),
  { schema: SetWebsitePortalScopeSchema },
);

/** Public share approval — token-authenticated, no session required. */
export const setWebsiteShareApproval = enhanceAction(
  async (input) =>
    setShareApprovalByToken({
      token: input.token,
      targetType: input.targetType,
      targetId: input.targetId,
      pageId:
        input.pageId ??
        (input.targetType === 'page' ? input.targetId : undefined),
      status: input.status,
      note: input.note,
    }),
  { schema: SetShareApprovalSchema, auth: false },
);

/** Portal session approval — client_members + portal_share_scope. */
export const setPortalWebsiteApprovalAction = enhanceAction(
  async (input) =>
    setPortalWebsiteApproval({
      clientOrgId: input.clientOrgId,
      websiteId: input.websiteId,
      targetType: input.targetType,
      targetId: input.targetId,
      pageId:
        input.pageId ??
        (input.targetType === 'page' ? input.targetId : undefined),
      status: input.status,
      note: input.note,
    }),
  { schema: SetPortalWebsiteApprovalSchema },
);

export const listWebsiteApprovalsAction = enhanceAction(
  async (input) =>
    createWebsiteApprovalsService(getSupabaseServerClient()).listForWebsite(
      input.accountId,
      input.websiteId,
    ),
  { schema: ListWebsiteApprovalsSchema },
);

/** Public share section comment — token-authenticated, no session required. */
export const setWebsiteShareSectionComment = enhanceAction(
  async (input) =>
    setShareSectionCommentByToken({
      token: input.token,
      pageId: input.pageId,
      sectionId: input.sectionId,
      comment: input.comment,
    }),
  { schema: SetShareSectionCommentSchema, auth: false },
);

/**
 * Create (or link) a delivery project for a website and apply the
 * Website design phase template, then deep-link the job to the website.
 */
export const createWebsiteProject = enhanceAction(
  async (input) =>
    createWebsitePlanningService(
      getSupabaseServerClient(),
    ).createOrLinkDeliveryProject({
      accountId: input.accountId,
      websiteId: input.websiteId,
      existingJobId: input.existingJobId,
    }),
  { schema: CreateWebsiteProjectSchema },
);
