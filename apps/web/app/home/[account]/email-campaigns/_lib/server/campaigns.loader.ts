import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { getCampaignUsage } from '~/lib/campaign-credits/ledger';
import { createCampaignsService } from '~/lib/campaigns/campaigns.service';
import {
  estimateCampaignAudienceCount,
  listAudiencePickerOptions,
} from '~/lib/campaigns/resolve-campaign-audience';
import {
  isSendingDomainVerified,
  loadAccountSendingDomain,
} from '~/lib/sending-domains/server';
import { listWorkspaceMailingListSubscribers } from '~/lib/workspace-forms/workspace-mailing-list';

export async function loadCampaignsPage(accountId: string) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const service = createCampaignsService(client);

  const [campaigns, subscribers, usage, brand] = await Promise.all([
    service.list(accountId),
    listWorkspaceMailingListSubscribers(admin, accountId),
    getCampaignUsage(accountId),
    loadAccountBrandResolved(accountId),
  ]);

  return {
    campaigns,
    subscriberCount: subscribers.length,
    subscribers: subscribers.slice(0, 25),
    usage: usage.pool,
    brand,
  };
}

export const loadCampaignDetail = cache(async function loadCampaignDetail(accountId: string, campaignId: string) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const service = createCampaignsService(client);

  const [campaign, recipients, usage, brand, sendingDomain, publishedForms, audienceOptions] =
    await Promise.all([
      service.get(accountId, campaignId),
      service.listRecipients(accountId, campaignId),
      getCampaignUsage(accountId),
      loadAccountBrandResolved(accountId),
      loadAccountSendingDomain(admin, accountId),
      listPublishedFormsForCampaigns(accountId),
      listAudiencePickerOptions(admin, accountId),
    ]);

  const audienceCount = await estimateCampaignAudienceCount(
    admin,
    accountId,
    campaign.audienceType,
    campaign.audienceConfig,
  );

  return {
    campaign,
    recipients,
    subscriberCount: audienceOptions.subscriberCount,
    audienceCount,
    audienceOptions,
    usage: usage.pool,
    brand,
    sendingDomain: sendingDomain
      ? {
          verified: isSendingDomainVerified(sendingDomain),
          sendingHost: sendingDomain.sending_host,
          defaultLocalPart: sendingDomain.default_local_part,
          domain: sendingDomain.domain,
        }
      : null,
    publishedForms,
  };
});

async function listPublishedFormsForCampaigns(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  // Table may be ahead of generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('workspace_forms')
    .select('id, name, share_token, status, enabled')
    .eq('account_id', accountId)
    .eq('status', 'published')
    .eq('enabled', true)
    .order('name', { ascending: true });

  if (error) {
    console.warn('[campaigns] list published forms failed', error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? 'Untitled form'),
      shareToken: String(row.share_token ?? ''),
    }))
    .filter((row) => row.shareToken.length >= 16);
}
