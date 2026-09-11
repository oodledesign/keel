import { describe, expect, it } from 'vitest';

import {
  RECURRING_INSTANCE_STATUS_LABEL,
  recurringInstanceStatus,
  seriesInstanceMaySend,
} from './campaign-series-ready';

describe('series instance ready gate', () => {
  it('lets one-off drafts and scheduled campaigns send', () => {
    expect(
      seriesInstanceMaySend({
        seriesId: null,
        ready: false,
        status: 'draft',
      }),
    ).toBe(true);
    expect(
      seriesInstanceMaySend({
        seriesId: null,
        ready: true,
        status: 'scheduled',
      }),
    ).toBe(true);
  });

  it('blocks series instances that are not ready', () => {
    expect(
      seriesInstanceMaySend({
        seriesId: 'series-1',
        ready: false,
        status: 'draft',
      }),
    ).toBe(false);
    expect(
      seriesInstanceMaySend({
        seriesId: 'series-1',
        ready: false,
        status: 'scheduled',
      }),
    ).toBe(false);
  });

  it('allows ready series instances in draft or scheduled', () => {
    expect(
      seriesInstanceMaySend({
        seriesId: 'series-1',
        ready: true,
        status: 'draft',
      }),
    ).toBe(true);
    expect(
      seriesInstanceMaySend({
        seriesId: 'series-1',
        ready: true,
        status: 'scheduled',
      }),
    ).toBe(true);
  });

  it('never sends cancelled, sending, sent, or failed rows', () => {
    for (const status of ['cancelled', 'sending', 'sent', 'failed'] as const) {
      expect(
        seriesInstanceMaySend({
          seriesId: 'series-1',
          ready: true,
          status,
        }),
      ).toBe(false);
    }
  });

  it('maps planner statuses Draft → Ready → Scheduled/Sent', () => {
    expect(recurringInstanceStatus({ status: 'draft', ready: false })).toBe(
      'draft',
    );
    expect(recurringInstanceStatus({ status: 'draft', ready: true })).toBe(
      'ready',
    );
    expect(recurringInstanceStatus({ status: 'scheduled', ready: true })).toBe(
      'scheduled',
    );
    expect(recurringInstanceStatus({ status: 'sent', ready: true })).toBe(
      'sent',
    );
    expect(recurringInstanceStatus({ status: 'cancelled', ready: false })).toBe(
      'skipped',
    );
    expect(RECURRING_INSTANCE_STATUS_LABEL.ready).toBe('Ready');
  });
});
