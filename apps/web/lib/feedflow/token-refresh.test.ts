import { describe, expect, it } from 'vitest';

import {
  INSTAGRAM_TOKEN_REFRESH_AFTER_MS,
  isInstagramTokenDueForRefresh,
} from './token-refresh-policy';

const now = Date.parse('2026-08-31T12:00:00.000Z');

describe('isInstagramTokenDueForRefresh', () => {
  it('skips tokens younger than 24 hours', () => {
    expect(
      isInstagramTokenDueForRefresh(
        {
          last_refreshed_at: '2026-08-31T06:00:00.000Z',
          token_expires_at: '2026-10-30T12:00:00.000Z',
          connected_at: '2026-08-31T06:00:00.000Z',
          created_at: '2026-08-31T06:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('refreshes around day 50', () => {
    const last = new Date(now - INSTAGRAM_TOKEN_REFRESH_AFTER_MS).toISOString();
    expect(
      isInstagramTokenDueForRefresh(
        {
          last_refreshed_at: last,
          token_expires_at: '2026-10-20T12:00:00.000Z',
          connected_at: last,
          created_at: last,
        },
        now,
      ),
    ).toBe(true);
  });

  it('refreshes when expiry is within 10 days', () => {
    expect(
      isInstagramTokenDueForRefresh(
        {
          last_refreshed_at: '2026-08-01T12:00:00.000Z',
          token_expires_at: '2026-09-05T12:00:00.000Z',
          connected_at: '2026-08-01T12:00:00.000Z',
          created_at: '2026-08-01T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });

  it('leaves a recently refreshed 60-day token alone', () => {
    expect(
      isInstagramTokenDueForRefresh(
        {
          last_refreshed_at: '2026-08-10T12:00:00.000Z',
          token_expires_at: '2026-10-09T12:00:00.000Z',
          connected_at: '2026-08-10T12:00:00.000Z',
          created_at: '2026-08-10T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });
});
