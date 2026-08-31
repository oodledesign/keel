/**
 * Starter per-seat pricing — single source of truth.
 * Must match the Stripe Price (`billing_scheme: tiered`, `tiers_mode: graduated`)
 * with two bands only: seat 1 → £14, seats 2+ → £9 each.
 *
 * Note: MakerKit checkout sets per_seat quantity to total billable seats.
 * A flat (£14) + per_seat (£9 × N) pair would over-charge seat 1, so Starter
 * uses one graduated Price instead of separate flat + per_seat line items.
 */

export const BUSINESS_STARTER_PRODUCT_ID = 'ozer-business-starter';
export const BUSINESS_STARTER_PLAN_ID = 'business-starter-monthly';

export const BUSINESS_STARTER_TIERS = [
  { upTo: 1, unitGbp: 14, bandLabel: 'Seat 1' },
  { upTo: Infinity, unitGbp: 9, bandLabel: 'Seats 2+' },
] as const;

export function clampStarterBillableSeats(seats: number): number {
  if (!Number.isFinite(seats)) return 1;
  return Math.max(1, Math.min(200, Math.floor(seats)));
}

export function estimateStarterMonthlyGbp(billableSeats: number): number {
  const seats = clampStarterBillableSeats(billableSeats);
  if (seats <= 0) return 0;
  if (seats === 1) return 14;
  return 14 + (seats - 1) * 9;
}

export function maxMembersForStarterBillableSeats(
  billableSeats: number,
): number {
  return clampStarterBillableSeats(billableSeats);
}
