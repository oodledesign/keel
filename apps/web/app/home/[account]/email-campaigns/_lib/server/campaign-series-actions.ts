'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseAddon } from '~/lib/billing/entitlements';
import { createCampaignSeriesService } from '~/lib/campaigns/campaign-series.service';

import {
  CampaignSeriesInstanceActionSchema,
  CreateCampaignSeriesSchema,
  UpdateCampaignSeriesSchema,
} from '../schemas/campaign-series.schema';

function campaignsPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    accountSlug,
  );
}

function recurringPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaignRecurring.replace(
    '[account]',
    accountSlug,
  );
}

function seriesPath(accountSlug: string, seriesId: string) {
  return pathsConfig.app.accountEmailCampaignSeriesDetail
    .replace('[account]', accountSlug)
    .replace('[seriesId]', seriesId);
}

function campaignPath(accountSlug: string, campaignId: string) {
  return pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);
}

function revalidateSeriesPaths(
  accountSlug: string,
  seriesId: string,
  campaignId?: string,
) {
  revalidatePath(campaignsPath(accountSlug));
  revalidatePath(recurringPath(accountSlug));
  revalidatePath(seriesPath(accountSlug, seriesId));
  if (campaignId) {
    revalidatePath(campaignPath(accountSlug, campaignId));
    revalidatePath(`${campaignPath(accountSlug, campaignId)}/content`);
    revalidatePath(`${campaignPath(accountSlug, campaignId)}/send`);
  }
}

async function requireCampaignsAddon(userId: string, accountId: string) {
  const client = getSupabaseServerClient();
  const allowed = await canUseAddon(
    client,
    userId,
    accountId,
    'addon_campaigns',
  );
  if (!allowed) {
    throw new Error(
      'Campaigns add-on required. Subscribe from Billing in this workspace.',
    );
  }
  return client;
}

export const createCampaignSeriesAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignSeriesService(client);
    const series = await service.create({
      accountId: data.accountId,
      userId: user.id,
      name: data.name,
      timezone: data.timezone,
      recurrenceByWeekday: data.recurrenceByWeekday,
      sendHour: data.sendHour,
      sendMinute: data.sendMinute,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      generateAhead: data.generateAhead,
      audienceType: data.audienceType,
      audienceConfig: data.audienceConfig,
      subject: data.subject,
      previewText: data.previewText,
      bodyDocument: data.bodyDocument,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo,
    });

    logger.info(
      { name: 'create-campaign-series', userId: user.id, seriesId: series.id },
      'Created recurring campaign series',
    );
    revalidateSeriesPaths(data.accountSlug, series.id);
    return { success: true as const, seriesId: series.id };
  },
  { auth: true, schema: CreateCampaignSeriesSchema },
);

export const updateCampaignSeriesAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignSeriesService(client);
    await service.update({
      accountId: data.accountId,
      seriesId: data.seriesId,
      name: data.name,
      timezone: data.timezone,
      recurrenceByWeekday: data.recurrenceByWeekday,
      sendHour: data.sendHour,
      sendMinute: data.sendMinute,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      generateAhead: data.generateAhead,
      audienceType: data.audienceType,
      audienceConfig: data.audienceConfig,
      subject: data.subject,
      previewText: data.previewText,
      status: data.status,
    });
    revalidateSeriesPaths(data.accountSlug, data.seriesId);
    return { success: true as const };
  },
  { auth: true, schema: UpdateCampaignSeriesSchema },
);

export const markCampaignInstanceReadyAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignSeriesService(client);
    await service.markInstanceReady({
      accountId: data.accountId,
      campaignId: data.campaignId,
    });
    revalidateSeriesPaths(data.accountSlug, data.seriesId, data.campaignId);
    return { success: true as const };
  },
  { auth: true, schema: CampaignSeriesInstanceActionSchema },
);

export const markCampaignInstanceUnreadyAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignSeriesService(client);
    await service.markInstanceUnready({
      accountId: data.accountId,
      campaignId: data.campaignId,
    });
    revalidateSeriesPaths(data.accountSlug, data.seriesId, data.campaignId);
    return { success: true as const };
  },
  { auth: true, schema: CampaignSeriesInstanceActionSchema },
);

export const skipCampaignInstanceAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignSeriesService(client);
    await service.skipInstance({
      accountId: data.accountId,
      campaignId: data.campaignId,
    });
    revalidateSeriesPaths(data.accountSlug, data.seriesId, data.campaignId);
    return { success: true as const };
  },
  { auth: true, schema: CampaignSeriesInstanceActionSchema },
);
