'use server';

import type { Data } from '@puckeditor/core';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  GetOzerSiteBundleSchema,
  PublishOzerSitePageSchema,
  PublishOzerSitesSchema,
  SaveOzerSitePageDraftSchema,
  UpdateOzerSiteSettingsSchema,
} from '../schema/site-studio.schema';
import { createOzerSitesService } from './ozer-sites.service';

function getService() {
  return createOzerSitesService(getSupabaseServerClient());
}

export const getOzerSiteBundle = enhanceAction(
  async (input) =>
    getService().getBundleForWebsite(input.accountId, input.websiteId, {
      clientOrgId: input.clientOrgId,
    }),
  { schema: GetOzerSiteBundleSchema },
);

export const publishWebsiteToOzerSites = enhanceAction(
  async (input) =>
    getService().publishFromWebsite(input.accountId, input.websiteId, {
      subdomain: input.subdomain,
      resolveConflicts: input.resolveConflicts,
    }),
  { schema: PublishOzerSitesSchema },
);

export const saveOzerSitePageDraft = enhanceAction(
  async (input) => {
    const service = getService();
    if (input.clientOrgId) {
      await service.ensurePortalMember(input.accountId, input.clientOrgId);
      const page = await service.getPage(input.accountId, input.pageId);
      if (!page) throw new Error('Page not found');
      const site = await service.getSiteById(input.accountId, page.siteId);
      if (!site?.settings.portalEditEnabled) {
        throw new Error('Portal editing is disabled for this site');
      }
    } else {
      await service.ensureAgencyMember(input.accountId);
    }
    return service.savePageDraft(
      input.accountId,
      input.pageId,
      input.puckData as Data,
      {
        asHumanEdit: input.asHumanEdit !== false,
        title: input.title,
      },
    );
  },
  { schema: SaveOzerSitePageDraftSchema },
);

export const publishOzerSitePage = enhanceAction(
  async (input) => {
    const service = getService();
    if (input.clientOrgId) {
      await service.ensurePortalMember(input.accountId, input.clientOrgId);
      const page = await service.getPage(input.accountId, input.pageId);
      if (!page) throw new Error('Page not found');
      const site = await service.getSiteById(input.accountId, page.siteId);
      if (!site?.settings.portalEditEnabled) {
        throw new Error('Portal editing is disabled for this site');
      }
    } else {
      await service.ensureAgencyMember(input.accountId);
    }
    return service.publishPage(input.accountId, input.pageId);
  },
  { schema: PublishOzerSitePageSchema },
);

export const updateOzerSiteSettings = enhanceAction(
  async (input) =>
    getService().updateSettings(input.accountId, input.siteId, input.settings),
  { schema: UpdateOzerSiteSettingsSchema },
);
