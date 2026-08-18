import { describe, expect, it } from 'vitest';

import {
  formatChargeAmount,
  isWithinRenewalNoticeWindow,
} from './renewal-notices.shared';

describe('isWithinRenewalNoticeWindow', () => {
  const now = new Date('2026-08-18T08:00:00.000Z');

  it('includes renewals in the next 36 hours', () => {
    expect(
      isWithinRenewalNoticeWindow(new Date('2026-08-19T08:00:00.000Z'), now),
    ).toBe(true);
    expect(
      isWithinRenewalNoticeWindow(new Date('2026-08-19T18:00:00.000Z'), now),
    ).toBe(true);
  });

  it('excludes past and far-future renewals', () => {
    expect(
      isWithinRenewalNoticeWindow(new Date('2026-08-18T07:00:00.000Z'), now),
    ).toBe(false);
    expect(
      isWithinRenewalNoticeWindow(new Date('2026-08-20T08:01:00.000Z'), now),
    ).toBe(false);
  });
});

describe('formatChargeAmount', () => {
  it('formats Stripe minor units as GBP', () => {
    expect(formatChargeAmount(8900, 'gbp')).toBe('£89.00');
  });
});
