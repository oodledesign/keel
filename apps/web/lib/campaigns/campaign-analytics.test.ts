import { describe, expect, it } from 'vitest';

import {
  aggregateLinkClicks,
  bucketEventsByDay,
  formatRate,
  summarizeCampaignRates,
} from './campaign-analytics';

describe('campaign analytics helpers', () => {
  it('computes rates from delivered when available', () => {
    const rates = summarizeCampaignRates({
      sent: 100,
      delivered: 80,
      uniqueOpens: 40,
      uniqueClicks: 8,
      bounces: 5,
      complaints: 1,
      unsubscribes: 2,
    });
    expect(rates.openRate).toBe(0.5);
    expect(rates.clickRate).toBe(0.1);
    expect(rates.bounceRate).toBe(0.05);
    expect(formatRate(rates.openRate)).toBe('50%');
  });

  it('buckets events by day and ranks link clicks', () => {
    const series = bucketEventsByDay([
      { eventType: 'open', eventAt: '2026-01-02T10:00:00.000Z' },
      { eventType: 'click', eventAt: '2026-01-02T11:00:00.000Z' },
      { eventType: 'open', eventAt: '2026-01-01T09:00:00.000Z' },
    ]);
    expect(series.map((row) => row.date)).toEqual(['2026-01-01', '2026-01-02']);
    expect(series[1]?.clicks).toBe(1);

    const links = aggregateLinkClicks([
      { eventType: 'click', linkUrl: 'https://ozer.app/a' },
      { eventType: 'click', linkUrl: 'https://ozer.app/a' },
      { eventType: 'click', linkUrl: 'https://ozer.app/b' },
      { eventType: 'open', linkUrl: 'https://ozer.app/ignored' },
    ]);
    expect(links[0]).toEqual({ url: 'https://ozer.app/a', clicks: 2 });
  });
});
