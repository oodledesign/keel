/**
 * How a disposal's asking rent is quoted, what it works out at per year, and
 * what Rightmove is sent. Shared by the form preview, list, brochure and the
 * Rightmove mapper so they never disagree.
 */

export type RentBasis = 'per_sqft' | 'per_annum' | 'per_month';

export const RENT_BASIS_OPTIONS: ReadonlyArray<{
  id: RentBasis;
  label: string;
  unit: string;
}> = [
  { id: 'per_sqft', label: 'Per sq ft', unit: 'per sq ft' },
  { id: 'per_annum', label: 'Per annum', unit: 'per annum' },
  { id: 'per_month', label: 'Per month', unit: 'per month' },
];

/**
 * Highest £/sq ft a yearly rent is likely to be. Above this the figure is
 * almost certainly a yearly total typed in as a rate, and multiplying it by
 * the size would send millions to Rightmove.
 */
export const MAX_RENT_PER_SQFT = 250;

/** Below this a "per annum" rent is almost certainly a £/sq ft rate. */
export const MIN_PLAUSIBLE_ANNUAL_RENT = 500;

/** Stored `rent_frequency` (or an imported label) to a basis; unknown is per annum. */
export function rentBasis(frequency: string | null | undefined): RentBasis {
  const value = frequency?.trim().toLowerCase() ?? '';
  if (!value) return 'per_annum';
  if (/sq|psf|square/.test(value)) return 'per_sqft';
  if (/month|pcm/.test(value)) return 'per_month';
  return 'per_annum';
}

export function rentBasisUnit(basis: RentBasis): string {
  return RENT_BASIS_OPTIONS.find((option) => option.id === basis)!.unit;
}

/** Compact suffix for lists and maps. */
export function rentBasisShortUnit(basis: RentBasis): 'pa' | 'pcm' | 'psf' {
  if (basis === 'per_month') return 'pcm';
  if (basis === 'per_sqft') return 'psf';
  return 'pa';
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function gbp(pounds: number, pence: boolean): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence ? 2 : 0,
    maximumFractionDigits: pence ? 2 : 0,
  }).format(pounds);
}

/** "£10.75", "£1.50–£3.00" or "£42,000". Rates keep their pence; totals are whole pounds. */
export function formatRentAmount(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  basis: RentBasis,
): string | null {
  const from = positive(fromPence);
  const to = positive(toPence);
  if (from == null && to == null) return null;
  const pence =
    basis === 'per_sqft' &&
    [from, to].some((value) => value != null && value % 100 !== 0);
  const low = (from ?? to)! / 100;
  const high = (to ?? from)! / 100;
  if (low === high) return gbp(low, pence);
  return `${gbp(Math.min(low, high), pence)}–${gbp(Math.max(low, high), pence)}`;
}

/** "£26 per sq ft", "£42,000 pa" (short) or "£42,000 per annum". */
export function formatRent(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  basis: RentBasis,
  style: 'long' | 'short' = 'long',
): string | null {
  const amount = formatRentAmount(fromPence, toPence, basis);
  if (!amount) return null;
  const unit =
    style === 'short' ? rentBasisShortUnit(basis) : rentBasisUnit(basis);
  return `${amount} ${unit}`;
}

export type ListingRentInput = {
  askingRentPence: number | null | undefined;
  askingRentToPence?: number | null;
  rentFrequency: string | null | undefined;
  sizeMinSqft: number | null | undefined;
  sizeMaxSqft: number | null | undefined;
};

/** Low and high yearly rent in whole pounds. */
export type AnnualRent = { from: number; to: number };

/**
 * The rent per year. A per sq ft rate is multiplied by the size (lowest rate
 * by smallest size, highest by largest). Null when there is no rent, a per sq
 * ft rent has no size, or the rate is implausibly high.
 */
export function annualRentPounds(input: ListingRentInput): AnnualRent | null {
  const basis = rentBasis(input.rentFrequency);
  const fromPence =
    positive(input.askingRentPence) ?? positive(input.askingRentToPence);
  const toPence = positive(input.askingRentToPence) ?? fromPence;
  if (fromPence == null || toPence == null) return null;
  const low = Math.min(fromPence, toPence) / 100;
  const high = Math.max(fromPence, toPence) / 100;

  if (basis === 'per_annum') {
    return { from: Math.round(low), to: Math.round(high) };
  }
  if (basis === 'per_month') {
    return { from: Math.round(low * 12), to: Math.round(high * 12) };
  }

  if (high > MAX_RENT_PER_SQFT) return null;
  const smallest = positive(input.sizeMinSqft) ?? positive(input.sizeMaxSqft);
  const largest = positive(input.sizeMaxSqft) ?? smallest;
  if (smallest == null || largest == null) return null;
  return {
    from: Math.round(low * Math.min(smallest, largest)),
    to: Math.round(high * Math.max(smallest, largest)),
  };
}

export function formatAnnualRent(annual: AnnualRent): string {
  return annual.from === annual.to
    ? `${gbp(annual.from, false)} per annum`
    : `${gbp(annual.from, false)}–${gbp(annual.to, false)} per annum`;
}

export type RentWarning =
  | 'rate_looks_like_total'
  | 'total_looks_like_rate'
  | 'rate_needs_size';

export const RENT_WARNING_TEXT: Record<RentWarning, string> = {
  rate_looks_like_total: `That looks like a yearly total, not a rate per sq ft. Switch to per annum, or enter the rate.`,
  total_looks_like_rate: `That looks like a rate per sq ft, not a yearly rent. Switch to per sq ft, or enter the yearly total.`,
  rate_needs_size:
    'Add a size so the yearly rent can be worked out. Until then Rightmove shows POA.',
};

export function rentWarnings(input: ListingRentInput): RentWarning[] {
  const basis = rentBasis(input.rentFrequency);
  const figures = [input.askingRentPence, input.askingRentToPence]
    .map(positive)
    .filter((value): value is number => value != null)
    .map((pence) => pence / 100);
  if (figures.length === 0) return [];

  if (basis === 'per_sqft') {
    if (figures.some((value) => value > MAX_RENT_PER_SQFT)) {
      return ['rate_looks_like_total'];
    }
    return annualRentPounds(input) == null ? ['rate_needs_size'] : [];
  }
  if (
    basis === 'per_annum' &&
    figures.some((value) => value < MIN_PLAUSIBLE_ANNUAL_RENT)
  ) {
    return ['total_looks_like_rate'];
  }
  return [];
}

/** What Rightmove is sent for the rent, before the POA placeholder is applied. */
export type RightmoveRent = {
  /** Null when there is no usable figure. */
  price: number | null;
  frequency: 'YEARLY' | 'MONTHLY';
  /** A range: shown on Rightmove as "From £…". */
  from: boolean;
  poa: boolean;
};

/**
 * Rightmove takes a yearly or monthly total. Per sq ft rents go as rate ×
 * size per year, the lowest figure marked "From" when there is a range.
 * Yearly and monthly rents keep their lower figure, as before.
 */
export function rightmoveRent(
  input: ListingRentInput & { hideRent: boolean },
): RightmoveRent {
  const basis = rentBasis(input.rentFrequency);
  if (basis === 'per_sqft') {
    const annual = annualRentPounds(input);
    return {
      price: annual?.from ?? null,
      frequency: 'YEARLY',
      from: annual != null && annual.to > annual.from,
      poa: input.hideRent || annual == null,
    };
  }
  const pence =
    positive(input.askingRentPence) ?? positive(input.askingRentToPence);
  const price = pence != null ? Math.round(pence) / 100 : null;
  return {
    price,
    frequency: basis === 'per_month' ? 'MONTHLY' : 'YEARLY',
    from: false,
    poa: input.hideRent || price == null,
  };
}

/** How the rent reads on Rightmove, e.g. "From £55,952 per annum". */
export function describeRightmoveRent(rent: RightmoveRent): string {
  if (rent.poa || rent.price == null) return 'Price on application';
  const amount = gbp(rent.price, rent.price % 1 !== 0);
  const unit = rent.frequency === 'MONTHLY' ? 'per month' : 'per annum';
  return `${rent.from ? 'From ' : ''}${amount} ${unit}`;
}

/** A unit's rent per year from the disposal's rent, when the unit has none of its own. */
export function unitRentFromListing(
  input: Pick<
    ListingRentInput,
    'askingRentPence' | 'askingRentToPence' | 'rentFrequency'
  > & { unitSizeSqft: number | null | undefined },
): { price: number; frequency: 'YEARLY' | 'MONTHLY' } | null {
  const basis = rentBasis(input.rentFrequency);
  const pence =
    positive(input.askingRentPence) ?? positive(input.askingRentToPence);
  if (pence == null) return null;
  if (basis === 'per_sqft') {
    const size = positive(input.unitSizeSqft);
    if (size == null || pence / 100 > MAX_RENT_PER_SQFT) return null;
    return { price: Math.round((pence / 100) * size), frequency: 'YEARLY' };
  }
  return {
    price: Math.round(pence) / 100,
    frequency: basis === 'per_month' ? 'MONTHLY' : 'YEARLY',
  };
}
