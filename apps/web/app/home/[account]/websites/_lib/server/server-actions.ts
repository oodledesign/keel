'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteWebsiteSchema,
  GetWebsiteSchema,
  ListWebsitesSchema,
  UpdateWebsiteSchema,
  WebsiteInputSchema,
} from '../schema/websites.schema';
import { createWebsitePlanningService } from './website-planning.service';
import { createWebsitesService } from './websites.service';

const UpdateWebsiteActionSchema = UpdateWebsiteSchema.extend({
  accountId: z.string().uuid(),
});

function getService() {
  return createWebsitesService(getSupabaseServerClient());
}

export const listWebsites = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listWebsites(input);
  },
  { schema: ListWebsitesSchema },
);

export const getWebsite = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getWebsite(input);
  },
  { schema: GetWebsiteSchema },
);

export const listWebsiteClientOrgs = enhanceAction(
  async (input: { accountId: string }) => {
    const service = getService();
    return service.listClientOrgs(input.accountId);
  },
  {
    schema: ListWebsitesSchema.pick({ accountId: true }),
  },
);

export const createWebsite = enhanceAction(
  async (input) => {
    const service = getService();
    const created = await service.createWebsite(input);

    const shouldCreateProject =
      Boolean(input.create_delivery_project) || Boolean(input.existing_job_id);

    if (shouldCreateProject) {
      await createWebsitePlanningService(
        getSupabaseServerClient(),
      ).createOrLinkDeliveryProject({
        accountId: input.accountId,
        websiteId: created.id,
        existingJobId: input.existing_job_id ?? undefined,
      });
    }

    return created;
  },
  { schema: WebsiteInputSchema },
);

export const updateWebsite = enhanceAction(
  async (input) => {
    const service = getService();
    const { accountId, ...rest } = input;
    return service.updateWebsite(accountId, rest);
  },
  { schema: UpdateWebsiteActionSchema },
);

export const deleteWebsite = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteWebsite(input.accountId, input.websiteId);
    return { success: true };
  },
  { schema: DeleteWebsiteSchema },
);
