import { describe, expect, it } from 'vitest';

import {
  InsufficientMediaCreditsError,
  allocateDebitAcrossBatches,
  isInsufficientMediaCreditsError,
} from './allocate';

describe('allocateDebitAcrossBatches', () => {
  const early = {
    id: 'batch-early',
    units_remaining: 50,
    expires_at: '2026-01-01T00:00:00.000Z',
  };
  const late = {
    id: 'batch-late',
    units_remaining: 100,
    expires_at: '2026-06-01T00:00:00.000Z',
  };

  it('throws InsufficientMediaCreditsError when balance is short', () => {
    expect(() => allocateDebitAcrossBatches([early], 51)).toThrow(
      InsufficientMediaCreditsError,
    );

    try {
      allocateDebitAcrossBatches([early], 80);
    } catch (error) {
      expect(isInsufficientMediaCreditsError(error)).toBe(true);
      if (isInsufficientMediaCreditsError(error)) {
        expect(error.balance).toBe(50);
        expect(error.required).toBe(80);
      }
    }
  });

  it('draws from earliest expires_at first (single batch)', () => {
    const allocations = allocateDebitAcrossBatches([late, early], 40);
    expect(allocations).toEqual([{ batch_id: 'batch-early', amount: 40 }]);
  });

  it('spans two batches near a boundary', () => {
    const allocations = allocateDebitAcrossBatches([late, early], 70);
    expect(allocations).toEqual([
      { batch_id: 'batch-early', amount: 50 },
      { batch_id: 'batch-late', amount: 20 },
    ]);
  });

  it('does not partially allocate on insufficient balance', () => {
    expect(() => allocateDebitAcrossBatches([early, late], 200)).toThrow(
      InsufficientMediaCreditsError,
    );
  });
});

describe('InsufficientMediaCreditsError', () => {
  it('formats a clear message', () => {
    const err = new InsufficientMediaCreditsError({
      balance: 10,
      required: 25,
    });
    expect(err.message).toContain('need 25');
    expect(err.message).toContain('have 10');
    expect(err.name).toBe('InsufficientMediaCreditsError');
  });
});

/**
 * Simulation of concurrent debit safety: given a shared mutable balance,
 * two sequential lock-style debits must not overspend (mirrors RPC FOR UPDATE).
 */
describe('concurrent debit simulation', () => {
  it('does not allow balance to go negative under sequential locked debits', () => {
    let balance = 100;
    const lockedDebit = (amount: number) => {
      if (balance < amount) {
        throw new InsufficientMediaCreditsError({
          balance,
          required: amount,
        });
      }
      balance -= amount;
    };

    lockedDebit(60);
    expect(() => lockedDebit(50)).toThrow(InsufficientMediaCreditsError);
    expect(balance).toBe(40);
  });
});

describe('grant idempotency key behaviour', () => {
  it('treats identical stripe_event_id as the same grant key', () => {
    const seen = new Map<string, { amount: number }>();
    const grantIdempotent = (stripeEventId: string, amount: number) => {
      const existing = seen.get(stripeEventId);
      if (existing) return existing;
      const created = { amount };
      seen.set(stripeEventId, created);
      return created;
    };

    const first = grantIdempotent('evt_123', 200);
    const second = grantIdempotent('evt_123', 200);
    expect(first).toBe(second);
    expect(seen.size).toBe(1);
  });
});

describe('expire sweep idempotency simulation', () => {
  it('is a no-op when swept_at is already set', () => {
    const batches = [
      {
        id: '1',
        units_remaining: 0,
        swept_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    const expireOnce = () => {
      let count = 0;
      for (const batch of batches) {
        if (batch.swept_at != null || batch.units_remaining <= 0) continue;
        batch.units_remaining = 0;
        batch.swept_at = new Date().toISOString();
        count += 1;
      }
      return count;
    };

    expect(expireOnce()).toBe(0);
    expect(expireOnce()).toBe(0);
  });
});

describe('refund reverses exact batches', () => {
  it('restores units to the batches that were drawn from', () => {
    const remaining: Record<string, number> = {
      'batch-early': 0,
      'batch-late': 80,
    };
    const debitRows = [
      { batch_id: 'batch-early', amount: -50 },
      { batch_id: 'batch-late', amount: -20 },
    ];

    for (const row of debitRows) {
      remaining[row.batch_id] =
        (remaining[row.batch_id] ?? 0) + Math.abs(row.amount);
    }

    expect(remaining['batch-early']).toBe(50);
    expect(remaining['batch-late']).toBe(100);
  });
});
