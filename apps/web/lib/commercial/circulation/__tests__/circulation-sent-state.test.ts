import { describe, expect, it, vi } from 'vitest';

import { loadSentListingState } from '../circulation-delivery';
import type { ListingChange } from '../circulation-rematch';

vi.mock('server-only', () => ({}));

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function clientWithSentRows(
  rows: Array<{ email: string; listing_id: string; last_sent_at: string }>,
) {
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: rows, error: null }),
  });
  return { from: vi.fn(() => query) };
}

const priceDrop: ListingChange = {
  kind: 'price_drop',
  changedAt: '2026-10-05T09:00:00.000Z',
};

describe('loadSentListingState', () => {
  const rows = [
    // Sent before the drop: should count as new again.
    {
      email: 'Dana@Example.com',
      listing_id: 'dropped',
      last_sent_at: '2026-10-01T09:00:00.000Z',
    },
    // Sent after the drop: already saw the new price.
    {
      email: 'dana@example.com',
      listing_id: 'dropped-seen',
      last_sent_at: '2026-10-07T09:00:00.000Z',
    },
    // Never changed.
    {
      email: 'dana@example.com',
      listing_id: 'plain',
      last_sent_at: '2026-10-01T09:00:00.000Z',
    },
  ];
  const changes = new Map<string, ListingChange>([
    ['dropped', priceDrop],
    ['dropped-seen', priceDrop],
  ]);

  it('treats everything sent as sent when no change is active', async () => {
    const state = await loadSentListingState(
      clientWithSentRows(rows) as never,
      ACCOUNT_ID,
      ['dana@example.com'],
    );

    const dana = state.get('dana@example.com');
    expect([...dana!.sent].sort()).toEqual([
      'dropped',
      'dropped-seen',
      'plain',
    ]);
    expect(dana!.changedSince.size).toBe(0);
  });

  it('moves a listing changed since it was sent out of the sent set', async () => {
    const state = await loadSentListingState(
      clientWithSentRows(rows) as never,
      ACCOUNT_ID,
      ['dana@example.com'],
      changes,
    );

    const dana = state.get('dana@example.com');
    expect([...dana!.changedSince]).toEqual(['dropped']);
    expect([...dana!.sent].sort()).toEqual(['dropped-seen', 'plain']);
  });
});
