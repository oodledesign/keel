'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { normalizeWebsiteBrief } from '~/lib/websites/brief-types';

import {
  CreateWebsiteProjectSchema,
  CreateWebsiteShareSchema,
  GenerateWebsiteSeoPageSchema,
  GenerateWebsiteSitemapSchema,
  GenerateWebsiteWireframesSchema,
  GetSiteStudioBundleSchema,
  RevokeWebsiteShareSchema,
  SaveWebsiteBriefSchema,
  PatchWebsiteBriefSchema,
  ConfirmWebsiteBriefAiSchema,
  SaveWebsiteSeoPageSchema,
  SaveWebsiteStyleSystemSchema,
  SetShareApprovalSchema,
  SetShareSectionCommentSchema,
  SetWebsitePortalScopeSchema,
  SuggestWebsiteBriefSchema,
} from '../schema/site-studio.schema';
import {
  createSiteStudioService,
  setShareApprovalByToken,
  setShareSectionCommentByToken,
} from './site-studio.service';
import { createWebsitePlanningService } from './website-planning.service';

function getService() {
  return createSiteStudioService(getSupabaseServerClient());
}

export const getSiteStudioBundle = enhanceAction(
  async (input) => getService().getBundle(input.accountId, input.websiteId),
  { schema: GetSiteStudioBundleSchema },
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

export const generateWebsiteSitemap = enhanceAction(
  async (input) =>
    getService().generateSitemap(input.accountId, input.websiteId, input.mode),
  { schema: GenerateWebsiteSitemapSchema },
);

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
  { schema: GetSiteStudioBundleSchema },
);

export const saveWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().saveSeoPage(
      input.accountId,
      input.websiteId,
      input.pageId,
      input.fields,
    ),
  { schema: SaveWebsiteSeoPageSchema },
);

export const generateWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().generateSeoPage(input.accountId, input.websiteId, input.pageId),
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
      pageId: input.pageId,
      status: input.status,
      note: input.note,
    }),
  { schema: SetShareApprovalSchema, auth: false },
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
    createWebsitePlanningService(getSupabaseServerClient()).createOrLinkDeliveryProject({
      accountId: input.accountId,
      websiteId: input.websiteId,
      existingJobId: input.existingJobId,
    }),
  { schema: CreateWebsiteProjectSchema },
);
