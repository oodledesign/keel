import { describe, expect, it } from 'vitest';

import {
  CONTRACT_PUBLIC_TOKEN_TTL_DAYS,
  computeContractPublicTokenExpiry,
} from './public-token';

describe('computeContractPublicTokenExpiry', () => {
  it(`returns a timestamp ${CONTRACT_PUBLIC_TOKEN_TTL_DAYS} days after "from"`, () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeContractPublicTokenExpiry(from);
    const expected = new Date(from.getTime());
    expected.setUTCDate(expected.getUTCDate() + CONTRACT_PUBLIC_TOKEN_TTL_DAYS);
    expect(expiry).toBe(expected.toISOString());
  });

  it('honours a custom ttlDays', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(computeContractPublicTokenExpiry(from, 14)).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });

  it('defaults to now when no base date is provided', () => {
    const before = Date.now();
    const expiry = new Date(computeContractPublicTokenExpiry()).getTime();
    const after = Date.now();
    const ttlMs = CONTRACT_PUBLIC_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before + ttlMs);
    expect(expiry).toBeLessThanOrEqual(after + ttlMs + 1000);
  });
});
