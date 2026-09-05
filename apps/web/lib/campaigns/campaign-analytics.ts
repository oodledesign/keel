import type { EmailCampaign, EmailCampaignRecipient } from './campaign.types';

export type CampaignAnalyticsEvent = {
  eventType: string;
  eventAt: string;
  linkUrl: string | null;
  bounceType: string | null;
  bounceSubtype: string | null;
};

export type CampaignTimeSeriesPoint = {
  date: string;
  deliveries: number;
  opens: number;
  clicks: number;
  bounces: number;
  complaints: number;
};

export type CampaignLinkClick = {
  url: string;
  clicks: number;
};

/** First N SES events only; paginate later if campaigns exceed this. */
export const CAMPAIGN_ANALYTICS_EVENT_LIMIT = 2000;

export type CampaignAnalyticsView = {
  rates: {
    delivery: number | null;
    uniqueOpen: number | null;
    uniqueClick: number | null;
    bounce: number | null;
    complaint: number | null;
  };
  uniqueOpens: number;
  uniqueClicks: number;
  timeSeries: CampaignTimeSeriesPoint[];
  linkClicks: CampaignLinkClick[];
  bounceBreakdown: Array<{ type: string; count: number }>;
  eventsTruncated: boolean;
};

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function formatCampaignRate(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 1000) / 10}%`;
}

export function buildCampaignAnalyticsView(input: {
  campaign: Pick<
    EmailCampaign,
    | 'sentCount'
    | 'deliveredCount'
    | 'openCount'
    | 'clickCount'
    | 'bounceCount'
    | 'complaintCount'
  >;
  recipients: Array<
    Pick<
      EmailCampaignRecipient,
      'openedAt' | 'clickedAt' | 'bounceType' | 'bounceSubtype'
    >
  >;
  events: CampaignAnalyticsEvent[];
  eventsTruncated?: boolean;
}): CampaignAnalyticsView {
  const uniqueOpens = input.recipients.filter((row) => row.openedAt).length;
  const uniqueClicks = input.recipients.filter((row) => row.clickedAt).length;
  const sent = input.campaign.sentCount;
  const delivered = input.campaign.deliveredCount;

  const byDay = new Map<string, CampaignTimeSeriesPoint>();
  const linkCounts = new Map<string, number>();
  const bounceCounts = new Map<string, number>();

  for (const event of input.events) {
    const date = event.eventAt.slice(0, 10);
    const point = byDay.get(date) ?? {
      date,
      deliveries: 0,
      opens: 0,
      clicks: 0,
      bounces: 0,
      complaints: 0,
    };
    if (event.eventType === 'delivery') point.deliveries += 1;
    if (event.eventType === 'open') point.opens += 1;
    if (event.eventType === 'click') point.clicks += 1;
    if (event.eventType === 'bounce') point.bounces += 1;
    if (event.eventType === 'complaint') point.complaints += 1;
    byDay.set(date, point);

    if (event.eventType === 'click' && event.linkUrl) {
      linkCounts.set(event.linkUrl, (linkCounts.get(event.linkUrl) ?? 0) + 1);
    }
    if (event.eventType === 'bounce') {
      const label =
        [event.bounceType, event.bounceSubtype].filter(Boolean).join(' / ') ||
        'unknown';
      bounceCounts.set(label, (bounceCounts.get(label) ?? 0) + 1);
    }
  }

  if (bounceCounts.size === 0) {
    for (const row of input.recipients) {
      if (!row.bounceType) continue;
      const label = [row.bounceType, row.bounceSubtype]
        .filter(Boolean)
        .join(' / ');
      bounceCounts.set(label, (bounceCounts.get(label) ?? 0) + 1);
    }
  }

  return {
    rates: {
      delivery: rate(delivered, sent),
      uniqueOpen: rate(uniqueOpens, delivered || sent),
      uniqueClick: rate(uniqueClicks, delivered || sent),
      bounce: rate(input.campaign.bounceCount, sent),
      complaint: rate(input.campaign.complaintCount, sent),
    },
    uniqueOpens,
    uniqueClicks,
    timeSeries: [...byDay.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    linkClicks: [...linkCounts.entries()]
      .map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20),
    bounceBreakdown: [...bounceCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    eventsTruncated: Boolean(input.eventsTruncated),
  };
}
