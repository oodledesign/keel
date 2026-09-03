/**
 * Pure validation helpers for contract payment plans.
 *
 * Kept dependency-free (no `server-only`, no Supabase) so both the zod
 * schema and the service layer can reuse the same rule, and so it is cheap
 * to unit test.
 */

export interface PaymentPlanPercentLike {
  percent: number;
}

/** Percentages must sum to exactly 100% (within floating point tolerance). */
export const PAYMENT_PLAN_TOTAL_PERCENT = 100;

/** Tolerance for floating point rounding when summing percentages. */
export const PAYMENT_PLAN_TOTAL_TOLERANCE = 0.01;

/**
 * Sum of `percent` across payment plan rows, rounded to 2dp to avoid
 * floating point artefacts (e.g. 33.33 + 33.33 + 33.34).
 */
export function sumPaymentPlanPercent(
  items: readonly PaymentPlanPercentLike[],
): number {
  const total = items.reduce((sum, item) => {
    return Number.isFinite(item.percent) ? sum + item.percent : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * A payment plan is valid when empty (no instalments configured), or when
 * every row has a finite percent in [0, 100] and the rows sum to exactly
 * 100% (within tolerance). Rejects malformed values (NaN, Infinity,
 * negative, > 100) and totals that don't reconcile to 100%.
 */
export function isPaymentPlanTotalValid(
  items: readonly PaymentPlanPercentLike[],
): boolean {
  if (items.length === 0) return true;

  const hasMalformedPercent = items.some(
    (item) =>
      !Number.isFinite(item.percent) || item.percent < 0 || item.percent > 100,
  );
  if (hasMalformedPercent) return false;

  const total = sumPaymentPlanPercent(items);
  return Math.abs(total - PAYMENT_PLAN_TOTAL_PERCENT) <= PAYMENT_PLAN_TOTAL_TOLERANCE;
}
