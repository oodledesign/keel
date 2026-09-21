import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_SENDING_DELETE_ERROR,
  SERIES_INSTANCE_DELETE_ERROR,
  SERIES_SENDING_DELETE_ERROR,
  assertCampaignDeletable,
  campaignHasSendHistory,
  planSeriesDelete,
} from './campaign-delete';

describe('assertCampaignDeletable', () => {
  it('allows draft and sent one-off campaigns', () => {
    expect(() =>
      assertCampaignDeletable({ status: 'draft', seriesId: null }),
    ).not.toThrow();
    expect(() =>
      assertCampaignDeletable({ status: 'sent', seriesId: null }),
    ).not.toThrow();
    expect(() =>
      assertCampaignDeletable({ status: 'scheduled', seriesId: null }),
    ).not.toThrow();
  });

  it('blocks in-flight sends', () => {
    expect(() =>
      assertCampaignDeletable({ status: 'sending', seriesId: null }),
    ).toThrow(CAMPAIGN_SENDING_DELETE_ERROR);
  });

  it('blocks recurring occurrences', () => {
    expect(() =>
      assertCampaignDeletable({
        status: 'draft',
        seriesId: 'series-1',
      }),
    ).toThrow(SERIES_INSTANCE_DELETE_ERROR);
  });
});

describe('planSeriesDelete', () => {
  it('deletes unsent weeks and keeps sent history', () => {
    const plan = planSeriesDelete([
      { id: 'draft', status: 'draft' },
      { id: 'ready', status: 'scheduled' },
      { id: 'skipped', status: 'cancelled' },
      { id: 'sent', status: 'sent', sentCount: 12, sentAt: '2026-09-01' },
      { id: 'failed', status: 'failed' },
    ]);

    expect(plan.deleteInstanceIds).toEqual(['draft', 'ready', 'skipped']);
    expect(plan.hadSends).toBe(true);
  });

  it('reports no history when nothing has gone out', () => {
    const plan = planSeriesDelete([
      { id: 'a', status: 'draft' },
      { id: 'b', status: 'scheduled' },
    ]);

    expect(plan.deleteInstanceIds).toEqual(['a', 'b']);
    expect(plan.hadSends).toBe(false);
  });

  it('blocks delete while an occurrence is sending', () => {
    expect(() =>
      planSeriesDelete([
        { id: 'a', status: 'draft' },
        { id: 'b', status: 'sending' },
      ]),
    ).toThrow(SERIES_SENDING_DELETE_ERROR);
  });
});

describe('campaignHasSendHistory', () => {
  it('is true for sent, failed, or counted sends', () => {
    expect(campaignHasSendHistory({ status: 'sent' })).toBe(true);
    expect(campaignHasSendHistory({ status: 'failed' })).toBe(true);
    expect(campaignHasSendHistory({ status: 'draft', sentCount: 1 })).toBe(
      true,
    );
    expect(
      campaignHasSendHistory({ status: 'draft', sentAt: '2026-09-01' }),
    ).toBe(true);
    expect(campaignHasSendHistory({ status: 'draft' })).toBe(false);
  });
});
