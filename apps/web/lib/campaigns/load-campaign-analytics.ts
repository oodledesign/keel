import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { pickAbWinner, summarizeAbVariant } from './campaign-ab';
import {
  type CampaignAnalyticsBundle,
  aggregateLinkClicks,
  bucketEventsByDay,
  summarizeCampaignRates,
} from './campaign-analytics';
import type { EmailCampaign, EmailCampaignRecipient } from './campaign.types';
import { fetchAllPagedRows } from './page-query';

export type { CampaignAnalyticsBundle } from './campaign-analytics';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

async function countCampaignRecipients(
  client: SupabaseClient,
  campaignId: string,
  // The builder is mutable; returning it keeps filters if a future client clones.
  apply: (query: ReturnType<typeof fromTable>) => ReturnType<typeof fromTable>,
): Promise<number> {
  const query = apply(
    fromTable(client, 'workspace_email_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId),
  );
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadCampaignAnalyticsBundle(
  client: SupabaseClient,
  campaign: EmailCampaign,
): Promise<CampaignAnalyticsBundle> {
  const [uniqueOpens, uniqueClicks] = await Promise.all([
    countCampaignRecipients(client, campaign.id, (query) =>
      query.not('opened_at', 'is', null),
    ),
    countCampaignRecipients(client, campaign.id, (query) =>
      query.not('clicked_at', 'is', null),
    ),
  ]);
  const rates = summarizeCampaignRates({
    sent: campaign.sentCount,
    delivered: campaign.deliveredCount,
    uniqueOpens,
    uniqueClicks,
    bounces: campaign.bounceCount,
    complaints: campaign.complaintCount,
    unsubscribes: campaign.unsubscribedCount,
  });

  const eventRows = await fetchAllPagedRows<{
    event_type: string;
    event_at: string;
    link_url: string | null;
  }>(async (from, to) =>
    fromTable(client, 'workspace_email_events')
      .select('event_type, event_at, link_url')
      .eq('campaign_id', campaign.id)
      .order('event_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );

  const events = eventRows.map((row) => ({
    eventType: String(row.event_type),
    eventAt: String(row.event_at),
    linkUrl: row.link_url ?? null,
  }));

  let ab: CampaignAnalyticsBundle['ab'] = null;
  if (campaign.abEnabled) {
    const variantStats = async (variant: 'a' | 'b') => {
      const [sent, opens, clicks] = await Promise.all([
        countCampaignRecipients(client, campaign.id, (query) =>
          query.eq('ab_variant', variant).eq('status', 'sent'),
        ),
        countCampaignRecipients(client, campaign.id, (query) =>
          query.eq('ab_variant', variant).not('opened_at', 'is', null),
        ),
        countCampaignRecipients(client, campaign.id, (query) =>
          query.eq('ab_variant', variant).not('clicked_at', 'is', null),
        ),
      ]);
      return summarizeAbVariant({
        variant,
        sent,
        uniqueOpens: opens,
        uniqueClicks: clicks,
      });
    };
    const [a, b] = await Promise.all([variantStats('a'), variantStats('b')]);
    ab = { a, b, winner: pickAbWinner(a, b) };
  }

  return {
    rates,
    series: bucketEventsByDay(events),
    links: aggregateLinkClicks(events),
    ab,
    comparative: [],
  };
}

export async function loadComparativeCampaignReports(
  campaigns: EmailCampaign[],
  recipientsByCampaign: Map<string, EmailCampaignRecipient[]>,
) {
  return campaigns
    .filter((campaign) => campaign.status === 'sent' || campaign.sentCount > 0)
    .slice(0, 6)
    .map((campaign) => {
      const recipients = recipientsByCampaign.get(campaign.id) ?? [];
      const uniqueOpens =
        recipients.length > 0
          ? recipients.filter((row) => row.openedAt).length
          : campaign.openCount;
      const uniqueClicks =
        recipients.length > 0
          ? recipients.filter((row) => row.clickedAt).length
          : campaign.clickCount;
      return {
        id: campaign.id,
        name: campaign.name,
        sentAt: campaign.sentAt,
        rates: summarizeCampaignRates({
          sent: campaign.sentCount,
          delivered: campaign.deliveredCount,
          uniqueOpens,
          uniqueClicks,
          bounces: campaign.bounceCount,
          complaints: campaign.complaintCount,
          unsubscribes: campaign.unsubscribedCount,
        }),
      };
    });
}
