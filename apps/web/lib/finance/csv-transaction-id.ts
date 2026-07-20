import 'server-only';

import { createHash } from 'crypto';

function normalizeDedupePart(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Stable id for CSV rows — dedupes the same bank line across multiple uploads. */
export function buildCsvTransactionExternalId(input: {
  accountId: string;
  bankAccountId: string | null;
  transactionDate: string;
  amountPence: number;
  counterparty: string;
  reference?: string;
}): string {
  const payload = [
    input.accountId,
    input.bankAccountId ?? '',
    input.transactionDate,
    String(input.amountPence),
    normalizeDedupePart(input.counterparty),
    normalizeDedupePart(input.reference ?? ''),
  ].join('|');

  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  return `csv:${hash}`;
}
