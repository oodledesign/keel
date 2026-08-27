/**
 * Commercial Property graduated per-seat pricing — single source of truth.
 * Must match the Stripe Price (`billing_scheme: tiered`, `tiers_mode: graduated`).
 *
 * Seat 1 → £89, seats 2–7 → £55 each, seats 8+ → £39 each.
 */

export const COMMERCIAL_GRADUATED_PRODUCT_ID = 'ozer-commercial-property';
export const COMMERCIAL_GRADUATED_PLAN_ID = 'commercial-property-monthly';

export const COMMERCIAL_GRADUATED_TIERS = [
  { upTo: 1, unitGbp: 89, bandLabel: 'Seat 1' },
  { upTo: 7, unitGbp: 55, bandLabel: 'Seats 2–7' },
  { upTo: Infinity, unitGbp: 39, bandLabel: 'Seats 8+' },
] as const;

/** Illustrative marketing card seat counts (wrappers around the same Price). */
export const COMMERCIAL_ILLUSTRATIVE_TIERS = [
  {
    id: 'solo',
    label: 'Commercial Solo',
    billableSeats: 1,
    description: 'Sole practitioner / micro agency',
    seatRangeLabel: '1 billable seat',
    bandTitle: 'Seat 1',
    highlighted: false,
  },
  {
    id: 'team',
    label: 'Commercial Team',
    billableSeats: 4,
    description: 'Typical regional commercial desk',
    seatRangeLabel: '2–7 billable seats',
    bandTitle: 'Seats 2–7',
    highlighted: true,
  },
  {
    id: 'scale',
    label: 'Commercial Scale',
    billableSeats: 10,
    description: 'Multi-negotiator / multi-branch',
    seatRangeLabel: '8+ billable seats',
    bandTitle: 'Seats 8+',
    highlighted: false,
  },
] as const;

export type CommercialSeatKind = 'billable' | 'support' | 'platform';

/** Normalise stored seat_kind values. */
export function parseCommercialSeatKind(
  value: string | null | undefined,
): CommercialSeatKind {
  if (value === 'support') return 'support';
  if (value === 'platform') return 'platform';
  return 'billable';
}

/** Seats that count toward plan limits or Stripe quantity. */
export function seatKindCountsTowardLimits(
  kind: CommercialSeatKind,
): boolean {
  return kind !== 'platform';
}

export function clampBillableSeats(seats: number): number {
  if (!Number.isFinite(seats)) return 1;
  return Math.max(1, Math.min(200, Math.floor(seats)));
}

export type GraduatedPricingBreakdownLine = {
  bandLabel: string;
  seatsInBand: number;
  unitGbp: number;
  subtotalGbp: number;
};

/**
 * Itemised graduated bands for N billable seats (same maths as Stripe).
 */
export function estimateMonthlyBreakdownGbp(billableSeats: number): {
  lines: GraduatedPricingBreakdownLine[];
  totalGbp: number;
} {
  const seats = clampBillableSeats(billableSeats);
  const lines: GraduatedPricingBreakdownLine[] = [];
  let previousUpTo = 0;

  for (const tier of COMMERCIAL_GRADUATED_TIERS) {
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
 * Mirrors Stripe graduated cumulative bands via COMMERCIAL_GRADUATED_TIERS.
 */
export function estimateMonthlyGbp(billableSeats: number): number {
  return estimateMonthlyBreakdownGbp(billableSeats).totalGbp;
}

/**
 * Human-readable worked total for marketing cards, driven by estimateMonthlyBreakdownGbp.
 * e.g. "e.g. 4 seats = £89 + 3 × £55 = £254/mo"
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
    const [only] = lines;
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
 * Free non-billable support seats included with the current billable headcount.
 * Solo (1): 0 · Team-sized (2–7): 2 · Scale-sized (8+): 4
 */
export function freeSupportSeats(billableSeats: number): number {
  const seats = clampBillableSeats(billableSeats);
  if (seats <= 1) return 0;
  if (seats <= 7) return 2;
  return 4;
}

/** Max total memberships = billable seats + free support allowance. */
export function maxMembersForBillableSeats(billableSeats: number): number {
  const seats = clampBillableSeats(billableSeats);
  return seats + freeSupportSeats(seats);
}

/** Portal publishing (Rightmove / EACH / Property Hive) is included from seat 1. */
export function portalPublishingAllowed(billableSeats: number): boolean {
  return clampBillableSeats(billableSeats) >= 1;
}

export function illustrativeTierForSeats(billableSeats: number): {
  id: (typeof COMMERCIAL_ILLUSTRATIVE_TIERS)[number]['id'];
  label: string;
} {
  const seats = clampBillableSeats(billableSeats);
  if (seats <= 1) {
    return { id: 'solo', label: 'Commercial Solo' };
  }
  if (seats <= 7) {
    return { id: 'team', label: 'Commercial Team' };
  }
  return { id: 'scale', label: 'Commercial Scale' };
}
