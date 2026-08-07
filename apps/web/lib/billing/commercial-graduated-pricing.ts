/**
 * Commercial Property graduated per-seat pricing — single source of truth.
 * Must match the Stripe Price (`billing_scheme: tiered`, `tiers_mode: graduated`).
 *
 * Seat 1 → £89, seats 2–7 → £55 each, seats 8+ → £39 each.
 */

export const COMMERCIAL_GRADUATED_PRODUCT_ID = 'ozer-commercial-property';
export const COMMERCIAL_GRADUATED_PLAN_ID = 'commercial-property-monthly';

export const COMMERCIAL_GRADUATED_TIERS = [
  { upTo: 1, unitGbp: 89 },
  { upTo: 7, unitGbp: 55 },
  { upTo: Infinity, unitGbp: 39 },
] as const;

/** Illustrative marketing card seat counts (wrappers around the same Price). */
export const COMMERCIAL_ILLUSTRATIVE_TIERS = [
  {
    id: 'solo',
    label: 'Commercial Solo',
    billableSeats: 1,
    description: 'Sole practitioner / micro agency',
    seatRangeLabel: '1 billable seat',
    highlighted: false,
  },
  {
    id: 'team',
    label: 'Commercial Team',
    billableSeats: 4,
    description: 'Typical regional commercial desk',
    seatRangeLabel: '2–7 billable seats',
    highlighted: true,
  },
  {
    id: 'scale',
    label: 'Commercial Scale',
    billableSeats: 10,
    description: 'Multi-negotiator / multi-branch',
    seatRangeLabel: '8+ billable seats',
    highlighted: false,
  },
] as const;

export type CommercialSeatKind = 'billable' | 'support';

export function clampBillableSeats(seats: number): number {
  if (!Number.isFinite(seats)) return 1;
  return Math.max(1, Math.min(200, Math.floor(seats)));
}

/**
 * Graduated monthly estimate in GBP for N billable seats.
 * Mirrors Stripe graduated cumulative bands via COMMERCIAL_GRADUATED_TIERS.
 */
export function estimateMonthlyGbp(billableSeats: number): number {
  const seats = clampBillableSeats(billableSeats);
  let total = 0;
  let previousUpTo = 0;

  for (const tier of COMMERCIAL_GRADUATED_TIERS) {
    const tierCap = tier.upTo === Infinity ? seats : tier.upTo;
    const seatsInBand = Math.min(seats, tierCap) - previousUpTo;
    if (seatsInBand > 0) {
      total += seatsInBand * tier.unitGbp;
    }
    previousUpTo = tierCap;
    if (seats <= previousUpTo) break;
  }

  return total;
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

/** Portal publishing (Rightmove / EG) requires 2+ billable seats. */
export function portalPublishingAllowed(billableSeats: number): boolean {
  return clampBillableSeats(billableSeats) >= 2;
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
