/**
 * Client-safe analytics helpers for campaign rates and comparative reports.
 */
import type { CampaignAbStats, CampaignAbWinner } from './campaign-ab';

export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

export function formatRate(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 1000) / 10}%`;
}

export type CampaignRateSummary = {
  sent: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
  unsubscribeRate: number | null;
};

export function summarizeCampaignRates(input: {
  sent: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
}): CampaignRateSummary {
  const delivered = Math.max(0, input.delivered);
  const sent = Math.max(0, input.sent);
  const denom = delivered > 0 ? delivered : sent;
  return {
    sent,
    delivered,
    uniqueOpens: input.uniqueOpens,
    uniqueClicks: input.uniqueClicks,
    bounces: input.bounces,
    complaints: input.complaints,
    unsubscribes: input.unsubscribes,
    deliveryRate: rate(delivered, sent),
    openRate: rate(input.uniqueOpens, denom),
    clickRate: rate(input.uniqueClicks, denom),
    bounceRate: rate(input.bounces, sent),
    complaintRate: rate(input.complaints, sent),
    unsubscribeRate: rate(input.unsubscribes, sent),
  };
}

export type CampaignEventPoint = {
  date: string;
  opens: number;
  clicks: number;
  bounces: number;
  complaints: number;
};

export function bucketEventsByDay(
  events: Array<{ eventType: string; eventAt: string }>,
): CampaignEventPoint[] {
  const map = new Map<string, CampaignEventPoint>();
  for (const event of events) {
    const date = event.eventAt.slice(0, 10);
    const row =
      map.get(date) ??
      ({
        date,
        opens: 0,
        clicks: 0,
        bounces: 0,
        complaints: 0,
      } satisfies CampaignEventPoint);
    if (event.eventType === 'open') row.opens += 1;
    if (event.eventType === 'click') row.clicks += 1;
    if (event.eventType === 'bounce') row.bounces += 1;
    if (event.eventType === 'complaint') row.complaints += 1;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type CampaignLinkStat = {
  url: string;
  clicks: number;
};

export type CampaignComparativeRow = {
  id: string;
  name: string;
  sentAt: string | null;
  rates: CampaignRateSummary;
};

export type CampaignAnalyticsBundle = {
  rates: CampaignRateSummary;
  series: CampaignEventPoint[];
  links: CampaignLinkStat[];
  ab: {
    a: CampaignAbStats;
    b: CampaignAbStats;
    winner: CampaignAbWinner;
  } | null;
  comparative: CampaignComparativeRow[];
};

export function aggregateLinkClicks(
  events: Array<{ eventType: string; linkUrl?: string | null }>,
): CampaignLinkStat[] {
  const map = new Map<string, number>();
  for (const event of events) {
    if (event.eventType !== 'click') continue;
    const url = event.linkUrl?.trim();
    if (!url) continue;
    map.set(url, (map.get(url) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([url, clicks]) => ({ url, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);
}
