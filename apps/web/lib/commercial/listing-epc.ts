import {
  extractUkPostcode,
  normalizeEnergyBand,
  normalizeUkPostcode,
  normalizeUprn,
} from '~/lib/building-surveyor/epc/parse';
import type {
  EpcCertificateSummary,
  EpcSearchHit,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';

export type ListingEpcLookup = SurveyPropertyLookup;

export type ListingEpcFields = {
  epcBand: string | null;
  epcRating: number | null;
};

export type ListingEpcPulledSnapshot = ListingEpcFields;

export type RankedListingEpcHit = EpcSearchHit & {
  matchScore: number;
  addressLabel: string;
  register: 'non-domestic' | 'domestic';
};

export type ListingEpcSearchResult = {
  configured: boolean;
  lookup: ListingEpcLookup;
  hits: RankedListingEpcHit[];
  highConfidenceCertificateNumber: string | null;
};

export type ListingEpcAttachment = ListingEpcFields & {
  certificateNumber: string | null;
  fetchedAt: string | null;
  pulled: ListingEpcFields | null;
};

export function listingToEpcAttachment(listing: {
  epcBand: string | null;
  epcRating: number | null;
  epcCertificateNumber?: string | null;
  epcFetchedAt?: string | null;
}): ListingEpcAttachment {
  return {
    epcBand: listing.epcBand,
    epcRating: listing.epcRating,
    certificateNumber: listing.epcCertificateNumber ?? null,
    fetchedAt: listing.epcFetchedAt ?? null,
    pulled: null,
  };
}

const EPC_RATING_MAX = 999;

export function listingEpcLookupFromAddress(input: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  postcode?: string | null;
  uprn?: string | null;
  name?: string | null;
}): ListingEpcLookup {
  const address = [input.addressLine1, input.addressLine2, input.town]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const postcode =
    normalizeUkPostcode(input.postcode) ||
    extractUkPostcode(input.postcode) ||
    extractUkPostcode(address) ||
    extractUkPostcode(input.name);

  return {
    address: address || input.name?.trim() || null,
    postcode,
    uprn: normalizeUprn(input.uprn),
  };
}

export function clampListingEpcRating(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > EPC_RATING_MAX) return null;
  return rounded;
}

export function listingEpcFieldsFromSearchHit(
  hit: Pick<EpcSearchHit, 'currentEnergyEfficiencyBand'>,
): ListingEpcFields {
  return {
    epcBand: normalizeEnergyBand(hit.currentEnergyEfficiencyBand),
    // Search rows expose a band only — score comes from the certificate.
    epcRating: null,
  };
}

export function listingEpcFieldsFromCertificate(
  summary: Pick<EpcCertificateSummary, 'currentRating' | 'currentScore'>,
): ListingEpcFields {
  return {
    epcBand: normalizeEnergyBand(summary.currentRating),
    epcRating: clampListingEpcRating(summary.currentScore),
  };
}

export function snapshotListingEpcFields(
  input: Partial<ListingEpcFields> | null | undefined,
): ListingEpcFields {
  return {
    epcBand: normalizeEnergyBand(input?.epcBand),
    epcRating: clampListingEpcRating(input?.epcRating),
  };
}

export function parseListingEpcPulledSnapshot(
  value: unknown,
): ListingEpcPulledSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const band = normalizeEnergyBand(
    readText(record, ['epcBand', 'epc_band', 'band', 'currentRating']),
  );
  const rating = clampListingEpcRating(
    readNumber(record, ['epcRating', 'epc_rating', 'rating', 'currentScore']),
  );
  if (!band && rating == null) return null;
  return { epcBand: band, epcRating: rating };
}

export function listingEpcFieldsEqual(
  left: Partial<ListingEpcFields> | null | undefined,
  right: Partial<ListingEpcFields> | null | undefined,
): boolean {
  const a = snapshotListingEpcFields(left);
  const b = snapshotListingEpcFields(right);
  return a.epcBand === b.epcBand && a.epcRating === b.epcRating;
}

/**
 * Keep user-edited band/rating when refreshing the same register certificate.
 * First attach (or a different certificate) always takes the pulled values.
 */
export function mergeListingEpcOnRefresh(input: {
  pulled: ListingEpcFields;
  current: ListingEpcFields;
  previousPulled?: ListingEpcFields | null;
  preserveOverrides?: boolean;
}): ListingEpcFields {
  const pulled = snapshotListingEpcFields(input.pulled);
  if (!input.preserveOverrides || !input.previousPulled) {
    return pulled;
  }

  const current = snapshotListingEpcFields(input.current);
  const previous = snapshotListingEpcFields(input.previousPulled);

  return {
    epcBand:
      current.epcBand !== previous.epcBand ? current.epcBand : pulled.epcBand,
    epcRating:
      current.epcRating !== previous.epcRating
        ? current.epcRating
        : pulled.epcRating,
  };
}

function readText(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const trimmed = String(value).trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function readNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}
