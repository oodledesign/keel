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

/** Project guests per billable seat on Starter. */
export const STARTER_PROJECT_GUESTS_PER_SEAT = 1;

export function clampStarterBillableSeats(seats: number): number {
  if (!Number.isFinite(seats)) return 1;
  return Math.max(1, Math.min(200, Math.floor(seats)));
}

export type StarterPricingBreakdownLine = {
  bandLabel: string;
  seatsInBand: number;
  unitGbp: number;
  subtotalGbp: number;
};

export function estimateStarterMonthlyBreakdownGbp(billableSeats: number): {
  lines: StarterPricingBreakdownLine[];
  totalGbp: number;
} {
  const seats = clampStarterBillableSeats(billableSeats);
  if (seats <= 0) {
    return { lines: [], totalGbp: 0 };
  }

  const lines: StarterPricingBreakdownLine[] = [
    {
      bandLabel: 'Seat 1',
      seatsInBand: 1,
      unitGbp: 14,
      subtotalGbp: 14,
    },
  ];

  if (seats > 1) {
    lines.push({
      bandLabel: 'Seats 2+',
      seatsInBand: seats - 1,
      unitGbp: 9,
      subtotalGbp: (seats - 1) * 9,
    });
  }

  return {
    lines,
    totalGbp: lines.reduce((sum, line) => sum + line.subtotalGbp, 0),
  };
}

export function estimateStarterMonthlyGbp(billableSeats: number): number {
  return estimateStarterMonthlyBreakdownGbp(billableSeats).totalGbp;
}

export function formatStarterWorkedExample(
  billableSeats: number,
  formatMoney: (gbp: number) => string,
): string {
  const seats = clampStarterBillableSeats(billableSeats);
  const { lines, totalGbp } = estimateStarterMonthlyBreakdownGbp(seats);

  if (lines.length === 0) {
    return `${formatMoney(0)}/mo`;
  }

  if (lines.length === 1) {
    return `e.g. ${seats} seat = ${formatMoney(totalGbp)}/mo`;
  }

  return `e.g. ${seats} seats = ${formatMoney(14)} + ${seats - 1} × ${formatMoney(9)} = ${formatMoney(totalGbp)}/mo`;
}

export function maxMembersForStarterBillableSeats(
  billableSeats: number,
): number {
  return clampStarterBillableSeats(billableSeats);
}

export function maxProjectGuestsForStarterBillableSeats(
  billableSeats: number,
): number {
  return STARTER_PROJECT_GUESTS_PER_SEAT * clampStarterBillableSeats(billableSeats);
}
