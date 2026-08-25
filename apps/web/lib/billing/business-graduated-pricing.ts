/**
 * Business graduated per-seat pricing — single source of truth.
 * Must match the Stripe Price (`billing_scheme: tiered`, `tiers_mode: graduated`).
 *
 * Seat 1 → £29, seats 2–5 → £22 each, seats 6+ → £16 each.
 * Shared AI pool and project-guest allowance scale with billable seats.
 */

export const BUSINESS_GRADUATED_PRODUCT_ID = 'ozer-business';
export const BUSINESS_GRADUATED_PLAN_ID = 'business-monthly';

export const BUSINESS_GRADUATED_TIERS = [
  { upTo: 1, unitGbp: 29, bandLabel: 'Seat 1' },
  { upTo: 5, unitGbp: 22, bandLabel: 'Seats 2–5' },
  { upTo: Infinity, unitGbp: 16, bandLabel: 'Seats 6+' },
] as const;

/** Illustrative marketing card seat counts (wrappers around the same Price). */
export const BUSINESS_ILLUSTRATIVE_TIERS = [
  {
    id: 'solo',
    label: 'Business Solo',
    billableSeats: 1,
    description: 'Solo freelancer / one-person studio',
    seatRangeLabel: '1 billable seat',
    bandTitle: 'Seat 1',
    highlighted: false,
  },
  {
    id: 'team',
    label: 'Business Team',
    billableSeats: 4,
    description: 'Small studio / growing practice',
    seatRangeLabel: '2–5 billable seats',
    bandTitle: 'Seats 2–5',
    highlighted: true,
  },
  {
    id: 'scale',
    label: 'Business Scale',
    billableSeats: 10,
    description: 'Larger studio / multi-role desk',
    seatRangeLabel: '6+ billable seats',
    bandTitle: 'Seats 6+',
    highlighted: false,
  },
] as const;

/** Lite (free) project-guest allowance. */
export const BUSINESS_LITE_MAX_PROJECT_GUESTS = 1;

/** Project guests per billable seat on paid Business (workspace-wide pool). */
export const BUSINESS_PROJECT_GUESTS_PER_SEAT = 3;

export function clampBillableSeats(seats: number): number {
  if (!Number.isFinite(seats)) return 1;
  return Math.max(1, Math.min(200, Math.floor(seats)));
}

export type BusinessGraduatedPricingBreakdownLine = {
  bandLabel: string;
  seatsInBand: number;
  unitGbp: number;
  subtotalGbp: number;
};

/**
 * Itemised graduated bands for N billable seats (same maths as Stripe).
 */
export function estimateMonthlyBreakdownGbp(billableSeats: number): {
  lines: BusinessGraduatedPricingBreakdownLine[];
  totalGbp: number;
} {
  const seats = clampBillableSeats(billableSeats);
  const lines: BusinessGraduatedPricingBreakdownLine[] = [];
  let previousUpTo = 0;

  for (const tier of BUSINESS_GRADUATED_TIERS) {
    const tierCap = tier.upTo === Infinity ? seats : tier.upTo;
    const seatsInBand = Math.min(seats, tierCap) - previousUpTo;
    if (seatsInBand > 0) {
      lines.push({
        bandLabel: tier.bandLabel,
        seatsInBand,
        unitGbp: tier.unitGbp,
        subtotalGbp: seatsInBand * tier.unitGbp,
      });
    }
    previousUpTo = tierCap;
    if (seats <= previousUpTo) break;
  }

  return {
    lines,
    totalGbp: lines.reduce((sum, line) => sum + line.subtotalGbp, 0),
  };
}

/**
 * Graduated monthly estimate in GBP for N billable seats.
 */
export function estimateMonthlyGbp(billableSeats: number): number {
  return estimateMonthlyBreakdownGbp(billableSeats).totalGbp;
}

/**
 * Human-readable worked total for marketing cards.
 * e.g. "e.g. 4 seats = £29 + 3 × £22 = £95/mo"
 */
export function formatGraduatedWorkedExample(
  billableSeats: number,
  formatMoney: (gbp: number) => string,
): string {
  const seats = clampBillableSeats(billableSeats);
  const { lines, totalGbp } = estimateMonthlyBreakdownGbp(seats);

  if (lines.length === 0) {
    return `${formatMoney(0)}/mo`;
  }

  if (lines.length === 1) {
    const only = lines[0]!;
    return `e.g. ${seats} seat${seats === 1 ? '' : 's'} = ${formatMoney(only.subtotalGbp)}/mo`;
  }

  const expression = lines
    .map((line, index) => {
      if (index === 0 && line.seatsInBand === 1) {
        return formatMoney(line.unitGbp);
      }
      return `${line.seatsInBand} × ${formatMoney(line.unitGbp)}`;
    })
    .join(' + ');

  return `e.g. ${seats} seats = ${expression} = ${formatMoney(totalGbp)}/mo`;
}

/**
 * Shared AI credit pool for paid Business from billable seat count.
 * Seat 1 → 3,000; seats 2–5 → +1,500 each; seats 6+ → +1,000 each.
 */
export function aiCreditsForBillableSeats(billableSeats: number): number {
  const seats = clampBillableSeats(billableSeats);
  let credits = 0;

  for (let seat = 1; seat <= seats; seat += 1) {
    if (seat === 1) {
      credits += 3000;
    } else if (seat <= 5) {
      credits += 1500;
    } else {
      credits += 1000;
    }
  }

  return credits;
}

/**
 * Workspace-wide project-guest allowance for paid Business.
 * Lite uses BUSINESS_LITE_MAX_PROJECT_GUESTS separately.
 */
export function maxProjectGuestsForBillableSeats(
  billableSeats: number,
): number {
  return BUSINESS_PROJECT_GUESTS_PER_SEAT * clampBillableSeats(billableSeats);
}

/** Max memberships = billable seats (no free support seats on Business). */
export function maxMembersForBillableSeats(billableSeats: number): number {
  return clampBillableSeats(billableSeats);
}

export function illustrativeTierForSeats(billableSeats: number): {
  id: (typeof BUSINESS_ILLUSTRATIVE_TIERS)[number]['id'];
  label: string;
} {
  const seats = clampBillableSeats(billableSeats);
  if (seats <= 1) {
    return { id: 'solo', label: 'Business Solo' };
  }
  if (seats <= 5) {
    return { id: 'team', label: 'Business Team' };
  }
  return { id: 'scale', label: 'Business Scale' };
}
