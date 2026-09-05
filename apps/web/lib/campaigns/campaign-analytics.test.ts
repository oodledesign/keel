import { describe, expect, it } from 'vitest';

import {
  buildCampaignAnalyticsView,
  formatCampaignRate,
} from './campaign-analytics';

describe('campaign analytics view', () => {
  it('computes rates, time series, and per-link clicks from SES events', () => {
    const view = buildCampaignAnalyticsView({
      campaign: {
        sentCount: 10,
        deliveredCount: 8,
        openCount: 5,
        clickCount: 3,
        bounceCount: 2,
        complaintCount: 1,
      },
      recipients: [
        {
          openedAt: '2026-01-02T10:00:00Z',
          clickedAt: '2026-01-02T11:00:00Z',
          bounceType: null,
          bounceSubtype: null,
        },
        {
          openedAt: null,
          clickedAt: null,
          bounceType: 'Permanent',
          bounceSubtype: 'General',
        },
      ],
      events: [
        {
          eventType: 'delivery',
          eventAt: '2026-01-01T09:00:00Z',
          linkUrl: null,
          bounceType: null,
          bounceSubtype: null,
        },
        {
          eventType: 'open',
          eventAt: '2026-01-02T10:00:00Z',
          linkUrl: null,
          bounceType: null,
          bounceSubtype: null,
        },
        {
          eventType: 'click',
          eventAt: '2026-01-02T11:00:00Z',
          linkUrl: 'https://example.com/a',
          bounceType: null,
          bounceSubtype: null,
        },
        {
          eventType: 'click',
          eventAt: '2026-01-02T11:05:00Z',
          linkUrl: 'https://example.com/a',
          bounceType: null,
          bounceSubtype: null,
        },
        {
          eventType: 'click',
          eventAt: '2026-01-02T11:06:00Z',
          linkUrl: 'https://example.com/b',
          bounceType: null,
          bounceSubtype: null,
        },
        {
          eventType: 'bounce',
          eventAt: '2026-01-01T09:30:00Z',
          linkUrl: null,
          bounceType: 'Permanent',
          bounceSubtype: 'General',
        },
      ],
    });

    expect(view.rates.delivery).toBe(0.8);
    expect(view.uniqueOpens).toBe(1);
    expect(view.uniqueClicks).toBe(1);
    expect(view.timeSeries).toHaveLength(2);
    expect(view.linkClicks[0]).toEqual({
      url: 'https://example.com/a',
      clicks: 2,
    });
    expect(view.bounceBreakdown[0]?.type).toBe('Permanent / General');
    expect(formatCampaignRate(view.rates.delivery)).toBe('80%');
  });

  it('does not invent rates when nothing has been sent', () => {
    const view = buildCampaignAnalyticsView({
      campaign: {
        sentCount: 0,
        deliveredCount: 0,
        openCount: 0,
        clickCount: 0,
        bounceCount: 0,
        complaintCount: 0,
      },
      recipients: [],
      events: [],
    });
    expect(view.rates.delivery).toBeNull();
    expect(formatCampaignRate(view.rates.uniqueOpen)).toBe('—');
    expect(view.timeSeries).toEqual([]);
    expect(view.linkClicks).toEqual([]);
  });
});
