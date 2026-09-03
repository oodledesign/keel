import { describe, expect, it } from 'vitest';

import {
  allSignersComplete,
  canSignerSign,
  isContractSigningExpired,
  nextUnsignedSigner,
  sortSignersByOrder,
} from './signing-order';

const signers = [
  { id: 'a', signing_order: 1, role: 'author', name: 'Dan', signed_at: '2026-01-01' },
  { id: 'b', signing_order: 2, role: 'signer', name: 'Client', signed_at: null },
  { id: 'c', signing_order: 3, role: 'signer', name: 'Witness', signed_at: null },
];

describe('sortSignersByOrder', () => {
  it('orders by signing_order regardless of input order', () => {
    expect(sortSignersByOrder([signers[2]!, signers[0]!, signers[1]!]).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('nextUnsignedSigner', () => {
  it('returns the first unsigned party', () => {
    expect(nextUnsignedSigner(signers)?.id).toBe('b');
  });

  it('returns null when everyone has signed', () => {
    expect(
      nextUnsignedSigner(signers.map((s) => ({ ...s, signed_at: 'x' }))),
    ).toBeNull();
  });
});

describe('canSignerSign', () => {
  it('allows the next unsigned party', () => {
    expect(canSignerSign(signers, 'b')).toEqual({
      ok: true,
      reason: null,
      waitingOn: null,
    });
  });

  it('blocks a later party until earlier ones have signed', () => {
    const result = canSignerSign(signers, 'c');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('waiting_on_earlier_party');
    expect(result.waitingOn?.id).toBe('b');
  });

  it('rejects an already-signed party', () => {
    expect(canSignerSign(signers, 'a').reason).toBe('already_signed');
  });
});

describe('allSignersComplete', () => {
  it('is false while anyone is outstanding, and false for an empty roster', () => {
    expect(allSignersComplete(signers)).toBe(false);
    expect(allSignersComplete([])).toBe(false);
    expect(
      allSignersComplete(signers.map((s) => ({ ...s, signed_at: 'x' }))),
    ).toBe(true);
  });
});

describe('isContractSigningExpired', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('treats null as no deadline', () => {
    expect(isContractSigningExpired(null, now)).toBe(false);
  });

  it('expires at or before now', () => {
    expect(isContractSigningExpired('2026-06-01T12:00:00.000Z', now)).toBe(true);
    expect(isContractSigningExpired('2026-05-01T00:00:00.000Z', now)).toBe(true);
    expect(isContractSigningExpired('2026-12-01T00:00:00.000Z', now)).toBe(false);
  });
});
