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

export type { CampaignAnalyticsBundle } from './campaign-analytics';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export async function loadCampaignAnalyticsBundle(
  client: SupabaseClient,
  campaign: EmailCampaign,
  recipients: EmailCampaignRecipient[],
): Promise<CampaignAnalyticsBundle> {
  const uniqueOpens = recipients.filter((row) => row.openedAt).length;
  const uniqueClicks = recipients.filter((row) => row.clickedAt).length;
  const rates = summarizeCampaignRates({
    sent: campaign.sentCount,
    delivered: campaign.deliveredCount,
    uniqueOpens,
    uniqueClicks,
    bounces: campaign.bounceCount,
    complaints: campaign.complaintCount,
    unsubscribes: campaign.unsubscribedCount,
  });

  const { data } = await fromTable(client, 'workspace_email_events')
    .select('event_type, event_at, link_url')
    .eq('campaign_id', campaign.id)
    .order('event_at', { ascending: true })
    .limit(2000);

  const events = ((data ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      eventType: String(row.event_type),
      eventAt: String(row.event_at),
      linkUrl: (row.link_url as string | null) ?? null,
    }),
  );

  let ab: CampaignAnalyticsBundle['ab'] = null;
  if (campaign.abEnabled) {
    const of = (variant: 'a' | 'b') =>
      recipients.filter((row) => row.abVariant === variant);
    const aRows = of('a');
    const bRows = of('b');
    const a = summarizeAbVariant({
      variant: 'a',
      sent: aRows.filter((row) => row.status === 'sent').length,
      uniqueOpens: aRows.filter((row) => row.openedAt).length,
      uniqueClicks: aRows.filter((row) => row.clickedAt).length,
    });
    const b = summarizeAbVariant({
      variant: 'b',
      sent: bRows.filter((row) => row.status === 'sent').length,
      uniqueOpens: bRows.filter((row) => row.openedAt).length,
      uniqueClicks: bRows.filter((row) => row.clickedAt).length,
    });
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
