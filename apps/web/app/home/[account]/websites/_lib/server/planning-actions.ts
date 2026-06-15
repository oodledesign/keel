'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateWebsiteContentDocSchema,
  DeleteWebsiteContentDocSchema,
  GetWebsiteForJobSchema,
  GetWebsitePlanningSchema,
  LinkWebsiteJobSchema,
  SaveWebsiteSitemapSchema,
  SaveWebsiteWireframesSchema,
  UpdateWebsiteContentDocSchema,
} from '../schema/website-planning.schema';
import { createWebsitePlanningService } from './website-planning.service';

function getService() {
  return createWebsitePlanningService(getSupabaseServerClient());
}

export const getWebsitePlanning = enhanceAction(
  async (input) => getService().getPlanningBundle(input.accountId, input.websiteId),
  { schema: GetWebsitePlanningSchema },
);

export const getWebsiteForJob = enhanceAction(
  async (input) => getService().getWebsiteForJob(input.accountId, input.jobId),
  { schema: GetWebsiteForJobSchema },
);

export const saveWebsiteSitemap = enhanceAction(
  async (input) =>
    getService().saveSitemap(input.accountId, input.websiteId, input.sitemap),
  { schema: SaveWebsiteSitemapSchema },
);

export const saveWebsiteWireframes = enhanceAction(
  async (input) =>
    getService().saveWireframes(
      input.accountId,
      input.websiteId,
      input.wireframes,
    ),
  { schema: SaveWebsiteWireframesSchema },
);

export const linkWebsiteJob = enhanceAction(
  async (input) =>
    getService().linkJob(input.accountId, input.websiteId, input.jobId),
  { schema: LinkWebsiteJobSchema },
);

export const createWebsiteContentDoc = enhanceAction(
  async (input) =>
    getService().createContentDoc(
      input.accountId,
      input.websiteId,
      input.title ?? 'Untitled',
    ),
  { schema: CreateWebsiteContentDocSchema },
);

export const updateWebsiteContentDoc = enhanceAction(
  async (input) =>
    getService().updateContentDoc(
      input.accountId,
      input.websiteId,
      input.docId,
      {
        title: input.title,
        contentMd: input.contentMd,
      },
    ),
  { schema: UpdateWebsiteContentDocSchema },
);

export const deleteWebsiteContentDoc = enhanceAction(
  async (input) =>
    getService().deleteContentDoc(
      input.accountId,
      input.websiteId,
      input.docId,
    ),
  { schema: DeleteWebsiteContentDocSchema },
);
