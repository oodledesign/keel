import {
  extractUkPostcode,
  formatEpcAddress,
  normalizeUkPostcode,
  normalizeUprn,
} from './parse';
import type { EpcSearchHit, SurveyPropertyLookup } from './types';

const STOP_WORDS = new Set([
  'the',
  'and',
  'flat',
  'apartment',
  'floor',
  'unit',
  'house',
  'street',
  'road',
  'lane',
  'avenue',
  'close',
  'drive',
  'way',
  'place',
  'court',
  'uk',
  'united',
  'kingdom',
  'england',
  'wales',
]);

export function tokenizeAddress(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function resolveSurveyLookup(input: {
  stored?: SurveyPropertyLookup | null;
  clientAddress?: string | null;
  clientPostcode?: string | null;
  title?: string | null;
}): SurveyPropertyLookup {
  const storedAddress = input.stored?.address?.trim() || null;
  const storedPostcode =
    normalizeUkPostcode(input.stored?.postcode) ||
    extractUkPostcode(storedAddress);
  const storedUprn = normalizeUprn(input.stored?.uprn);

  const clientAddress = input.clientAddress?.trim() || null;
  const clientPostcode =
    normalizeUkPostcode(input.clientPostcode) ||
    extractUkPostcode(clientAddress);
  const title = input.title?.trim() || null;
  const titlePostcode = extractUkPostcode(title);

  return {
    address: storedAddress || clientAddress || title,
    postcode: storedPostcode || clientPostcode || titlePostcode,
    uprn: storedUprn,
    latitude: input.stored?.latitude ?? null,
    longitude: input.stored?.longitude ?? null,
  };
}

export function scoreEpcHit(
  hit: EpcSearchHit,
  lookup: SurveyPropertyLookup,
): number {
  let score = 0;
  const lookupUprn = normalizeUprn(lookup.uprn);
  const hitUprn = normalizeUprn(hit.uprn);
  if (lookupUprn && hitUprn && lookupUprn === hitUprn) {
    score += 100;
  }

  const lookupPostcode = normalizeUkPostcode(lookup.postcode);
  const hitPostcode = normalizeUkPostcode(hit.postcode);
  if (lookupPostcode && hitPostcode && lookupPostcode === hitPostcode) {
    score += 30;
  }

  const queryTokens = tokenizeAddress(
    [lookup.address, lookup.postcode].filter(Boolean).join(' '),
  );
  const hitTokens = tokenizeAddress(
    formatEpcAddress({
      addressLine1: hit.addressLine1,
      addressLine2: hit.addressLine2,
      addressLine3: hit.addressLine3,
      addressLine4: hit.addressLine4,
      postTown: hit.postTown,
      postcode: hit.postcode,
    }),
  );

  if (queryTokens.length > 0 && hitTokens.length > 0) {
    const hitSet = new Set(hitTokens);
    const overlap = queryTokens.filter((token) => hitSet.has(token)).length;
    score += overlap * 8;
    if (overlap === queryTokens.length) score += 12;
  }

  if (hit.registrationDate) {
    const time = Date.parse(hit.registrationDate);
    if (!Number.isNaN(time)) {
      const ageYears = (Date.now() - time) / (1000 * 60 * 60 * 24 * 365);
      score += Math.max(0, 8 - ageYears);
    }
  }

  return score;
}

export function rankEpcHits(
  hits: EpcSearchHit[],
  lookup: SurveyPropertyLookup,
): Array<EpcSearchHit & { matchScore: number }> {
  return [...hits]
    .map((hit) => ({ ...hit, matchScore: scoreEpcHit(hit, lookup) }))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }
      const leftDate = Date.parse(left.registrationDate ?? '') || 0;
      const rightDate = Date.parse(right.registrationDate ?? '') || 0;
      return rightDate - leftDate;
    });
}

export function isHighConfidenceEpcMatch(
  hit: EpcSearchHit & { matchScore: number },
  lookup: SurveyPropertyLookup,
): boolean {
  const lookupUprn = normalizeUprn(lookup.uprn);
  const hitUprn = normalizeUprn(hit.uprn);
  if (lookupUprn && hitUprn && lookupUprn === hitUprn) return true;
  // postcode (30) + two address tokens (16) is enough without a UPRN.
  return hit.matchScore >= 46;
}
