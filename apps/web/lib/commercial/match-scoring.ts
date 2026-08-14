import {
  type DisposalType,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';

export type MatchListingSnapshot = {
  id: string;
  name: string;
  sector: string | null;
  disposalType: DisposalType;
  town: string | null;
  postcode: string | null;
  addressLine1: string | null;
  latitude: number | null;
  longitude: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
  status: string;
};

export type MatchRequirementSnapshot = {
  id: string;
  companyName: string | null;
  contactName: string | null;
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
  notes: string | null;
  stage: string;
  updatedAt: string;
};

export type MatchScoreBreakdown = {
  sector: number;
  size: number;
  location: number;
  tenure: number;
  budget: number;
};

export type MatchScoreResult = {
  score: number;
  reasons: string[];
  breakdown: MatchScoreBreakdown;
};

const WEIGHTS = {
  sector: 25,
  size: 25,
  location: 20,
  tenure: 15,
  budget: 15,
} as const;

const SECTOR_ALIASES: Record<string, string> = {
  industrial: 'industrial',
  warehouse: 'industrial',
  logistics: 'industrial',
  distribution: 'industrial',
  office: 'office',
  offices: 'office',
  retail: 'retail',
  shop: 'retail',
  leisure: 'leisure',
  mixed: 'mixed',
  'mixed use': 'mixed',
  land: 'land',
};

function tokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function normalizeSector(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? '';
  if (!raw) return null;
  return SECTOR_ALIASES[raw] ?? raw;
}

function rangeOverlapRatio(
  aMin: number | null,
  aMax: number | null,
  bMin: number | null,
  bMax: number | null,
): number | null {
  if (aMin == null && aMax == null) return null;
  if (bMin == null && bMax == null) return null;

  const aLo = aMin ?? aMax ?? 0;
  const aHi = aMax ?? aMin ?? aLo;
  const bLo = bMin ?? bMax ?? 0;
  const bHi = bMax ?? bMin ?? bLo;

  const overlap = Math.max(0, Math.min(aHi, bHi) - Math.max(aLo, bLo));
  if (overlap > 0) {
    // Jaccard-style: rewards size bands that actually align, not just
    // "listing sits inside a very wide brief".
    const union = Math.max(aHi, bHi) - Math.min(aLo, bLo);
    return Math.min(1, overlap / Math.max(1, union));
  }

  // Near miss: midpoints within 25% of each other
  const aMid = (aLo + aHi) / 2;
  const bMid = (bLo + bHi) / 2;
  const span = Math.max(aMid, bMid, 1);
  const distance = Math.abs(aMid - bMid) / span;
  if (distance <= 0.25) return 0.45;
  if (distance <= 0.5) return 0.2;
  return 0;
}

function scoreSector(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  reasons: string[],
): number {
  const a = normalizeSector(listing.sector);
  const b = normalizeSector(requirement.sector);
  // Low soft fill so incomplete briefs don't all cluster mid-band.
  if (!a || !b) return Math.round(0.15 * WEIGHTS.sector);

  if (a === b) {
    reasons.push(`Sector match (${listing.sector})`);
    return WEIGHTS.sector;
  }

  if (a.includes(b) || b.includes(a)) {
    reasons.push(`Related sector (${listing.sector} ≈ ${requirement.sector})`);
    return Math.round(WEIGHTS.sector * 0.7);
  }

  return 0;
}

function scoreSize(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  reasons: string[],
): number {
  const overlap = rangeOverlapRatio(
    listing.sizeMinSqft,
    listing.sizeMaxSqft,
    requirement.sizeMinSqft,
    requirement.sizeMaxSqft,
  );
  if (overlap == null) return Math.round(0.15 * WEIGHTS.size);

  // Confirmed mismatch should not outscore "unknown size".
  if (overlap === 0) return 0;

  // Continuous scoring spreads near-identical bands instead of 3 buckets.
  const points = Math.round(WEIGHTS.size * (0.25 + 0.75 * overlap));
  if (overlap >= 0.85) {
    reasons.push('Size band overlaps well');
  } else if (overlap >= 0.45) {
    reasons.push('Partial size overlap');
  } else if (overlap > 0) {
    reasons.push('Size is close');
  }
  return points;
}

function scoreLocation(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  reasons: string[],
): number {
  const listingLat = listing.latitude;
  const listingLng = listing.longitude;
  const reqLat = requirement.latitude;
  const reqLng = requirement.longitude;
  const radius = requirement.searchRadiusMiles;

  const hasCoords =
    listingLat != null &&
    listingLng != null &&
    reqLat != null &&
    reqLng != null &&
    Number.isFinite(listingLat) &&
    Number.isFinite(listingLng) &&
    Number.isFinite(reqLat) &&
    Number.isFinite(reqLng);

  if (hasCoords) {
    const miles = haversineMiles(reqLat, reqLng, listingLat, listingLng);

    if (radius != null && Number.isFinite(radius) && radius > 0) {
      if (miles <= radius) {
        reasons.push(
          `Within ${radius} mi search radius (${miles.toFixed(1)} mi)`,
        );
        return WEIGHTS.location;
      }
      reasons.push('Outside search radius');
      return 0;
    }

    if (miles <= 5) {
      reasons.push(`Close by (${miles.toFixed(1)} mi)`);
      return WEIGHTS.location;
    }
    if (miles <= 15) {
      reasons.push(`Nearby (${miles.toFixed(1)} mi)`);
      return Math.round(WEIGHTS.location * 0.5);
    }
    // Fall through to token overlap for distant coords
  }

  const reqTokens = new Set(tokens(requirement.locationText));
  if (reqTokens.size === 0) return Math.round(0.15 * WEIGHTS.location);

  const listingBits = [
    listing.town,
    listing.postcode,
    listing.addressLine1,
    listing.name,
  ]
    .flatMap((v) => tokens(v))
    .filter(Boolean);

  if (listingBits.length === 0) return Math.round(0.12 * WEIGHTS.location);

  const hits = listingBits.filter((t) => reqTokens.has(t));
  if (hits.length === 0) return 0;

  // Prefer town/postcode hits
  const strong = hits.some(
    (t) =>
      tokens(listing.town).includes(t) || tokens(listing.postcode).includes(t),
  );

  if (strong) {
    reasons.push(`Location fit (${hits.slice(0, 2).join(', ')})`);
    return WEIGHTS.location;
  }

  reasons.push('Soft location overlap');
  return Math.round(WEIGHTS.location * 0.55);
}

/** Great-circle distance in miles between two WGS84 points. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function scoreTenure(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  reasons: string[],
): number {
  const tenure = requirement.tenure;
  if (!tenure) return Math.round(0.2 * WEIGHTS.tenure);

  const lets = disposalIncludesToLet(listing.disposalType);
  const sells = disposalIncludesForSale(listing.disposalType);

  if (tenure === 'both') {
    if (lets || sells) {
      reasons.push('Tenure flexible (rent or buy)');
      return WEIGHTS.tenure;
    }
    return 0;
  }

  if (tenure === 'rent') {
    if (lets) {
      reasons.push('To let matches rent brief');
      return WEIGHTS.tenure;
    }
    return 0;
  }

  if (tenure === 'buy') {
    if (sells) {
      reasons.push('For sale matches buy brief');
      return WEIGHTS.tenure;
    }
    return 0;
  }

  return 0;
}

function withinBudget(
  amount: number,
  min: number | null,
  max: number | null,
): 'in' | 'near' | 'out' | 'unknown' {
  if (min == null && max == null) return 'unknown';
  if (min != null && max != null) {
    if (amount >= min && amount <= max) return 'in';
    const span = Math.max(max - min, max * 0.1, 1);
    if (amount >= min - span * 0.2 && amount <= max + span * 0.2) return 'near';
    return 'out';
  }
  if (max != null) {
    if (amount <= max) return 'in';
    if (amount <= max * 1.15) return 'near';
    return 'out';
  }
  if (min != null) {
    if (amount >= min) return 'in';
    if (amount >= min * 0.85) return 'near';
    return 'out';
  }
  return 'unknown';
}

function scoreBudget(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  reasons: string[],
): number {
  const tenure = requirement.tenure;
  const min = requirement.budgetMinPence;
  const max = requirement.budgetMaxPence;
  if (min == null && max == null) return Math.round(0.15 * WEIGHTS.budget);

  const rentCandidates = [
    listing.askingRentPence,
    listing.askingRentToPence,
  ].filter((n): n is number => n != null && n > 0);
  const price = listing.askingPricePence;

  const considerRent = tenure == null || tenure === 'rent' || tenure === 'both';
  const considerBuy = tenure == null || tenure === 'buy' || tenure === 'both';

  let best: 'in' | 'near' | 'out' | 'unknown' = 'unknown';

  if (considerRent && rentCandidates.length > 0) {
    for (const rent of rentCandidates) {
      const result = withinBudget(rent, min, max);
      if (result === 'in') best = 'in';
      else if (result === 'near' && best !== 'in') best = 'near';
      else if (result === 'out' && best === 'unknown') best = 'out';
    }
  }

  if (considerBuy && price != null && price > 0) {
    const result = withinBudget(price, min, max);
    if (result === 'in') best = 'in';
    else if (result === 'near' && best !== 'in') best = 'near';
    else if (result === 'out' && best === 'unknown') best = 'out';
  }

  if (best === 'unknown') return Math.round(0.15 * WEIGHTS.budget);
  if (best === 'in') {
    reasons.push('Within budget');
    return WEIGHTS.budget;
  }
  if (best === 'near') {
    reasons.push('Near budget');
    return Math.round(WEIGHTS.budget * 0.55);
  }
  return 0;
}

/** Deterministic 0–100 fit score for a disposal ↔ requirement pair. */
export function scoreListingRequirementMatch(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
): MatchScoreResult {
  const reasons: string[] = [];
  const breakdown: MatchScoreBreakdown = {
    sector: scoreSector(listing, requirement, reasons),
    size: scoreSize(listing, requirement, reasons),
    location: scoreLocation(listing, requirement, reasons),
    tenure: scoreTenure(listing, requirement, reasons),
    budget: scoreBudget(listing, requirement, reasons),
  };

  // Hard miss: tenure conflict with known tenure → cap low
  if (
    requirement.tenure === 'rent' &&
    !disposalIncludesToLet(listing.disposalType)
  ) {
    return {
      score: Math.min(20, Math.round(breakdown.sector + breakdown.size)),
      reasons: ['Tenure mismatch (rent vs for sale)'],
      breakdown,
    };
  }
  if (
    requirement.tenure === 'buy' &&
    !disposalIncludesForSale(listing.disposalType)
  ) {
    return {
      score: Math.min(20, Math.round(breakdown.sector + breakdown.size)),
      reasons: ['Tenure mismatch (buy vs to let)'],
      breakdown,
    };
  }

  const score = Math.round(
    breakdown.sector +
      breakdown.size +
      breakdown.location +
      breakdown.tenure +
      breakdown.budget,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 4),
    breakdown,
  };
}

export const ACTIVE_LISTING_STATUSES_FOR_MATCH = [
  'instructed',
  'marketing',
  'under_offer',
] as const;

export const ACTIVE_REQUIREMENT_STAGES_FOR_MATCH = [
  'new',
  'actively_searching',
  'under_offer_negotiating',
] as const;

export const DEFAULT_MATCH_SUGGESTION_MIN_SCORE = 40;
