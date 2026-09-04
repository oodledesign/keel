import { describe, expect, it } from 'vitest';

import {
  type RecipientEngagementRow,
  type SummaryCounts,
  buildRecipientEngagementPatch,
  buildSummaryCountPatch,
  isOncePerMessageEventType,
} from './engagement-patches';

const emptyRecipient = (): RecipientEngagementRow => ({
  delivered_at: null,
  opened_at: null,
  open_count: 0,
  clicked_at: null,
  click_count: 0,
  bounced_at: null,
  bounce_type: null,
  bounce_subtype: null,
  complaint_at: null,
});

describe('buildRecipientEngagementPatch', () => {
  it('sets delivered_at once', () => {
    const first = buildRecipientEngagementPatch(emptyRecipient(), {
      eventType: 'delivery',
      eventAt: '2026-09-04T12:00:00.000Z',
    });
    expect(first.isFirstOfKind).toBe(true);
    expect(first.bumpSummary).toBe(true);
    expect(first.patch.delivered_at).toBe('2026-09-04T12:00:00.000Z');

    const second = buildRecipientEngagementPatch(
      { ...emptyRecipient(), delivered_at: '2026-09-04T12:00:00.000Z' },
      { eventType: 'delivery', eventAt: '2026-09-04T12:05:00.000Z' },
    );
    expect(second.patch).toEqual({});
    expect(second.bumpSummary).toBe(false);
  });

  it('increments open_count on every open but opened_at once', () => {
    const first = buildRecipientEngagementPatch(emptyRecipient(), {
      eventType: 'open',
      eventAt: '2026-09-04T12:01:00.000Z',
    });
    expect(first.patch).toEqual({
      open_count: 1,
      opened_at: '2026-09-04T12:01:00.000Z',
    });
    expect(first.bumpSummary).toBe(true);

    const second = buildRecipientEngagementPatch(
      {
        ...emptyRecipient(),
        opened_at: '2026-09-04T12:01:00.000Z',
        open_count: 1,
      },
      { eventType: 'open', eventAt: '2026-09-04T12:02:00.000Z' },
    );
    expect(second.patch).toEqual({ open_count: 2 });
    expect(second.isFirstOfKind).toBe(false);
    expect(second.bumpSummary).toBe(true);
  });

  it('records bounce type metadata once', () => {
    const first = buildRecipientEngagementPatch(emptyRecipient(), {
      eventType: 'bounce',
      eventAt: '2026-09-04T12:03:00.000Z',
      bounceType: 'Permanent',
      bounceSubtype: 'General',
    });
    expect(first.patch).toMatchObject({
      bounced_at: '2026-09-04T12:03:00.000Z',
      bounce_type: 'Permanent',
      bounce_subtype: 'General',
    });
  });
});

describe('buildSummaryCountPatch', () => {
  const base: SummaryCounts = {
    delivered_count: 1,
    open_count: 2,
    click_count: 3,
    bounce_count: 0,
    complaint_count: 0,
  };

  it('increments the matching counter when bump is true', () => {
    expect(buildSummaryCountPatch(base, 'open', true)).toEqual({
      open_count: 3,
    });
    expect(buildSummaryCountPatch(base, 'delivery', true)).toEqual({
      delivered_count: 2,
    });
  });

  it('returns empty patch when bump is false', () => {
    expect(buildSummaryCountPatch(base, 'delivery', false)).toEqual({});
  });
});

describe('isOncePerMessageEventType', () => {
  it('marks delivery/bounce as once-only and open/click as repeatable', () => {
    expect(isOncePerMessageEventType('delivery')).toBe(true);
    expect(isOncePerMessageEventType('bounce')).toBe(true);
    expect(isOncePerMessageEventType('open')).toBe(false);
    expect(isOncePerMessageEventType('click')).toBe(false);
  });
});
