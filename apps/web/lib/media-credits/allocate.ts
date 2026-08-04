export type DebitAllocation = {
  batch_id: string;
  amount: number;
};

export class InsufficientMediaCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(payload: { balance: number; required: number }) {
    super(
      `Insufficient media credits: need ${payload.required}, have ${payload.balance}`,
    );
    this.name = 'InsufficientMediaCreditsError';
    this.balance = payload.balance;
    this.required = payload.required;
  }
}

export function isInsufficientMediaCreditsError(
  error: unknown,
): error is InsufficientMediaCreditsError {
  return error instanceof InsufficientMediaCreditsError;
}

/**
 * Pure FIFO allocator — mirrors debit_media_credits batch walk.
 * Production debits go through the Postgres RPC; this stays in sync for tests/UI.
 */
export function allocateDebitAcrossBatches(
  batches: Array<{ id: string; units_remaining: number; expires_at: string }>,
  amount: number,
): DebitAllocation[] {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }

  const ordered = [...batches].sort((a, b) =>
    a.expires_at.localeCompare(b.expires_at),
  );
  const total = ordered.reduce((sum, b) => sum + b.units_remaining, 0);

  if (total < amount) {
    throw new InsufficientMediaCreditsError({
      balance: total,
      required: amount,
    });
  }

  let remaining = amount;
  const allocations: DebitAllocation[] = [];

  for (const batch of ordered) {
    if (remaining <= 0) break;
    if (batch.units_remaining <= 0) continue;

    const take = Math.min(batch.units_remaining, remaining);
    allocations.push({ batch_id: batch.id, amount: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error('debit allocation incomplete');
  }

  return allocations;
}
