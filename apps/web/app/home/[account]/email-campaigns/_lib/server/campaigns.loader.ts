import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { hasCampaignsProFeatures } from '~/lib/billing/campaign-pricing';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { createAudienceListsService } from '~/lib/campaigns/audience-lists.service';
import { createCampaignAutomationsService } from '~/lib/campaigns/campaign-automations.service';
import { createCampaignsService } from '~/lib/campaigns/campaigns.service';
import {
  loadCampaignAnalyticsBundle,
  loadComparativeCampaignReports,
} from '~/lib/campaigns/load-campaign-analytics';
import { loadCampaignUsageSnapshot } from '~/lib/campaigns/load-campaign-usage-snapshot';
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

  const [campaigns, subscribers, brand] = await Promise.all([
    service.list(accountId),
    listWorkspaceMailingListSubscribers(admin, accountId),
    loadAccountBrandResolved(accountId),
  ]);

  const snapshot = await loadCampaignUsageSnapshot({
    accountId,
    contactsUsed: subscribers.length,
  });

  return {
    campaigns,
    subscriberCount: subscribers.length,
    subscribers: subscribers.slice(0, 25),
    usage: snapshot,
    brand,
  };
}

export const loadCampaignDetail = cache(async function loadCampaignDetail(
  accountId: string,
  campaignId: string,
) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const service = createCampaignsService(client);

  const [
    campaign,
    recipients,
    brand,
    sendingDomain,
    publishedForms,
    audienceOptions,
    lists,
  ] = await Promise.all([
    service.get(accountId, campaignId),
    service.listRecipients(accountId, campaignId),
    loadAccountBrandResolved(accountId),
    loadAccountSendingDomain(admin, accountId),
    listPublishedFormsForCampaigns(accountId),
    listAudiencePickerOptions(admin, accountId),
    createAudienceListsService(client)
      .list(accountId)
      .catch(() => []),
  ]);

  const [audienceCount, snapshot, analytics] = await Promise.all([
    estimateCampaignAudienceCount(
      admin,
      accountId,
      campaign.audienceType,
      campaign.audienceConfig,
    ).catch((error: unknown) => {
      console.warn(
        '[campaigns] audience estimate failed',
        error instanceof Error ? error.message : error,
      );
      return 0;
    }),
    loadCampaignUsageSnapshot({
      accountId,
      contactsUsed: audienceOptions.subscriberCount,
    }),
    loadCampaignAnalyticsBundle(admin, campaign, recipients),
  ]);

  if (hasCampaignsProFeatures(snapshot.planTier)) {
    const peers = (await service.list(accountId)).filter(
      (row) => row.id !== campaign.id,
    );
    analytics.comparative = await loadComparativeCampaignReports(
      peers,
      new Map(),
    );
  }

  return {
    campaign,
    recipients,
    subscriberCount: audienceOptions.subscriberCount,
    audienceCount,
    audienceOptions,
    lists,
    usage: snapshot,
    analytics,
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

export async function loadCampaignsGrowthHub(accountId: string) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const [lists, automations, campaigns, subscribers] = await Promise.all([
    createAudienceListsService(client)
      .list(accountId)
      .catch(() => []),
    createCampaignAutomationsService(client)
      .list(accountId)
      .catch(() => []),
    createCampaignsService(client).list(accountId),
    listWorkspaceMailingListSubscribers(admin, accountId),
  ]);
  const snapshot = await loadCampaignUsageSnapshot({
    accountId,
    contactsUsed: subscribers.length,
  });
  return { lists, automations, campaigns, snapshot };
}
