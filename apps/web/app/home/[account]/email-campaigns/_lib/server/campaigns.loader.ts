import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createWorkspaceFormsService } from '~/home/[account]/forms/_lib/server/workspace-forms.service';
import { hasCampaignsProFeatures } from '~/lib/billing/campaign-pricing';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { createAudienceListsService } from '~/lib/campaigns/audience-lists.service';
import { createCampaignAutomationsService } from '~/lib/campaigns/campaign-automations.service';
import { createCampaignContactsService } from '~/lib/campaigns/campaign-contacts.service';
import type { CampaignLinkedFormSubmissions } from '~/lib/campaigns/campaign-form-submissions';
import { createCampaignSeriesService } from '~/lib/campaigns/campaign-series.service';
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
import { isRsvpLikeWorkspaceForm } from '~/lib/workspace-forms/form-theme';
import { listWorkspaceMailingListSubscribers } from '~/lib/workspace-forms/workspace-mailing-list';

export async function loadCampaignsPage(accountId: string) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const service = createCampaignsService(client);

  const seriesService = createCampaignSeriesService(client);
  const [campaigns, series, subscribers, brand] = await Promise.all([
    service.list(accountId),
    seriesService.list(accountId).catch(() => []),
    listWorkspaceMailingListSubscribers(admin, accountId),
    loadAccountBrandResolved(accountId),
  ]);

  const snapshot = await loadCampaignUsageSnapshot({
    accountId,
    contactsUsed: subscribers.length,
  });

  return {
    campaigns,
    series,
    subscriberCount: subscribers.length,
    subscribers: subscribers.slice(0, 25),
    usage: snapshot,
    brand,
  };
}

export async function loadCampaignsRecurringPage(accountId: string) {
  const client = getSupabaseServerClient();
  const seriesService = createCampaignSeriesService(client);
  const series = await seriesService.list(accountId);
  const instancesBySeries = await Promise.all(
    series.map(async (row) => ({
      series: row,
      instances: await seriesService.listInstances(accountId, row.id),
    })),
  );
  return { groups: instancesBySeries };
}

export async function loadCampaignSeriesDetail(
  accountId: string,
  seriesId: string,
) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();
  const seriesService = createCampaignSeriesService(client);
  const [series, instances, brand, audienceOptions, lists] = await Promise.all([
    seriesService.get(accountId, seriesId),
    seriesService.listInstances(accountId, seriesId),
    loadAccountBrandResolved(accountId),
    listAudiencePickerOptions(admin, accountId),
    createAudienceListsService(client)
      .list(accountId)
      .catch(() => []),
  ]);

  return {
    series,
    instances,
    brand,
    audienceOptions,
    lists,
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

  const series = campaign.seriesId
    ? await createCampaignSeriesService(client)
        .get(accountId, campaign.seriesId)
        .catch(() => null)
    : null;

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
    series,
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

export async function loadCampaignAudienceWorkspace(accountId: string) {
  const client = getSupabaseServerClient();
  const contacts = createCampaignContactsService(client);
  const listsService = createAudienceListsService(client);
  const [hub, categories, workspaceContacts] = await Promise.all([
    loadCampaignsGrowthHub(accountId),
    contacts.listCategories(accountId).catch(() => []),
    contacts.listContacts(accountId, { limit: 400 }).catch(() => []),
  ]);

  const membersByList: Record<
    string,
    Awaited<ReturnType<typeof listsService.listMembers>>
  > = {};

  await Promise.all(
    hub.lists
      .filter((row) => row.source === 'manual')
      .map(async (list) => {
        try {
          membersByList[list.id] = await listsService.listMembers(
            accountId,
            list.id,
          );
        } catch {
          membersByList[list.id] = [];
        }
      }),
  );

  return {
    ...hub,
    categories,
    contacts: workspaceContacts,
    membersByList,
  };
}

export async function loadCampaignContactsPage(
  accountId: string,
  options?: {
    query?: string;
    categoryId?: string | null;
    industry?: string | null;
  },
) {
  const client = getSupabaseServerClient();
  const contactsService = createCampaignContactsService(client);
  const [hub, categories, contacts] = await Promise.all([
    loadCampaignsGrowthHub(accountId),
    contactsService.listCategories(accountId).catch(() => []),
    contactsService
      .listContacts(accountId, {
        query: options?.query,
        categoryId: options?.categoryId,
        industry: options?.industry,
        limit: 500,
      })
      .catch(() => []),
  ]);

  return {
    ...hub,
    categories,
    contacts,
  };
}

export const loadCampaignLinkedFormSubmissions = cache(
  async function loadCampaignLinkedFormSubmissions(
    accountId: string,
    formId: string | null | undefined,
  ): Promise<CampaignLinkedFormSubmissions | null> {
    if (!formId) return null;

    const client = getSupabaseServerClient();
    const forms = createWorkspaceFormsService(client);
    const form = await forms.getForm(accountId, formId).catch(() => null);
    if (!form) return null;

    const submissions = await forms
      .listSubmissions(accountId, form.id)
      .catch(() => []);

    return {
      formId: form.id,
      formName: form.name,
      isRsvp: isRsvpLikeWorkspaceForm({
        name: form.name,
        destination: form.destination,
        eventAddress: form.eventAddress,
        eventDate: form.eventDate,
        eventTime: form.eventTime,
        submitLabel: form.submitLabel,
        fields: form.fields,
      }),
      submissions: submissions.map((row) => ({
        id: row.id,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        createdAt: row.createdAt,
      })),
    };
  },
);
