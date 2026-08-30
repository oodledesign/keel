'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseAddon } from '~/lib/billing/entitlements';
import { createCampaignsService } from '~/lib/campaigns/campaigns.service';

import {
  CancelScheduleCampaignSchema,
  CreateCampaignSchema,
  ScheduleCampaignSchema,
  SendCampaignSchema,
  UpdateCampaignSchema,
} from '../schemas/campaigns.schema';

function campaignsPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    accountSlug,
  );
}

function campaignPath(accountSlug: string, campaignId: string) {
  return pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);
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

export const createCampaignAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    const campaign = await service.create({
      accountId: data.accountId,
      userId: user.id,
      name: data.name,
    });

    logger.info(
      { name: 'create-campaign', userId: user.id, campaignId: campaign.id },
      'Created email campaign',
    );
    revalidatePath(campaignsPath(data.accountSlug));
    return { success: true as const, campaignId: campaign.id };
  },
  { auth: true, schema: CreateCampaignSchema },
);

export const updateCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    const campaign = await service.update({
      accountId: data.accountId,
      campaignId: data.campaignId,
      name: data.name,
      subject: data.subject,
      previewText: data.previewText,
      bodyDocument: data.bodyDocument,
    });
    revalidatePath(campaignPath(data.accountSlug, campaign.id));
    revalidatePath(campaignsPath(data.accountSlug));
    return { success: true as const };
  },
  { auth: true, schema: UpdateCampaignSchema },
);

export const sendCampaignAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', data.accountId)
      .maybeSingle();

    const service = createCampaignsService(client);
    const result = await service.startSend({
      accountId: data.accountId,
      campaignId: data.campaignId,
      workspaceName:
        (account as { name?: string } | null)?.name?.trim() || 'Workspace',
    });

    logger.info(
      {
        name: 'send-campaign',
        userId: user.id,
        campaignId: data.campaignId,
        remaining: result.remaining,
      },
      'Started campaign send',
    );
    revalidatePath(campaignPath(data.accountSlug, data.campaignId));
    revalidatePath(campaignsPath(data.accountSlug));
    return {
      success: true as const,
      remaining: result.remaining,
      status: result.campaign.status,
    };
  },
  { auth: true, schema: SendCampaignSchema },
);

export const scheduleCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    await service.schedule({
      accountId: data.accountId,
      campaignId: data.campaignId,
      scheduledAt: data.scheduledAt,
    });
    revalidatePath(campaignPath(data.accountSlug, data.campaignId));
    revalidatePath(campaignsPath(data.accountSlug));
    return { success: true as const };
  },
  { auth: true, schema: ScheduleCampaignSchema },
);

export const cancelScheduleCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    await service.cancelSchedule(data.accountId, data.campaignId);
    revalidatePath(campaignPath(data.accountSlug, data.campaignId));
    revalidatePath(campaignsPath(data.accountSlug));
    return { success: true as const };
  },
  { auth: true, schema: CancelScheduleCampaignSchema },
);
