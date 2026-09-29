export type InvoicePurchaseSummary =
  | { kind: 'credit_topup'; credits: number; expiryMonths: number }
  | { kind: 'retainer_credits'; credits: number }
  | { kind: 'standard' };

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

/** Classify a paid invoice from the credit metadata stamped at creation. */
export function summarizeInvoicePurchase(
  metadata: unknown,
): InvoicePurchaseSummary {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { kind: 'standard' };
  }
  const meta = metadata as Record<string, unknown>;

  const topupCredits = positiveInt(meta.credit_topup_units);
  if (topupCredits) {
    return {
      kind: 'credit_topup',
      credits: topupCredits,
      expiryMonths: positiveInt(meta.credit_topup_expiry_months) ?? 6,
    };
  }

  const retainerCredits = positiveInt(meta.credits_per_cycle);
  if (retainerCredits) {
    return { kind: 'retainer_credits', credits: retainerCredits };
  }

  return { kind: 'standard' };
}

/** "Design work, Hosting +2 more" — null when there are no descriptions. */
export function formatInvoiceItemsLine(
  descriptions: Array<string | null | undefined>,
  max = 3,
): string | null {
  const items = descriptions
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (items.length === 0) return null;
  const shown = items.slice(0, max).join(', ');
  const extra = items.length - max;
  return extra > 0 ? `${shown} +${extra} more` : shown;
}
