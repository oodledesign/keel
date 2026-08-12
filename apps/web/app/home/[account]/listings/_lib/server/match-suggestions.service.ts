import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { DisposalType } from '~/lib/commercial/commercial-constants';
import {
  ACTIVE_LISTING_STATUSES_FOR_MATCH,
  ACTIVE_REQUIREMENT_STAGES_FOR_MATCH,
  DEFAULT_MATCH_SUGGESTION_MIN_SCORE,
  type MatchListingSnapshot,
  type MatchRequirementSnapshot,
  scoreListingRequirementMatch,
} from '~/lib/commercial/match-scoring';

export type MatchSuggestion = {
  listingId: string;
  requirementId: string;
  score: number;
  reasons: string[];
  listingName: string;
  listingSector: string | null;
  listingTown: string | null;
  listingDisposalType: DisposalType;
  listingSizeMinSqft: number | null;
  listingSizeMaxSqft: number | null;
  requirementLabel: string;
  requirementSector: string | null;
  requirementLocationText: string | null;
  requirementTenure: MatchRequirementSnapshot['tenure'];
  requirementSizeMinSqft: number | null;
  requirementSizeMaxSqft: number | null;
  requirementUpdatedAt: string;
  /** Present after AI explain/triage enrichment */
  aiWhyFit?: string | null;
  aiRecommendation?: 'add' | 'skip' | 'review' | null;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapListing(row: Record<string, unknown>): MatchListingSnapshot {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Disposal',
    sector: (row.sector as string | null) ?? null,
    disposalType: (row.disposal_type as DisposalType) ?? 'to_let',
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    addressLine1: (row.address_line1 as string | null) ?? null,
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    askingRentPence: num(row.asking_rent_pence),
    askingRentToPence: num(row.asking_rent_to_pence),
    askingPricePence: num(row.asking_price_pence),
    status: (row.status as string) ?? 'draft',
  };
}

function mapRequirement(
  row: Record<string, unknown>,
): MatchRequirementSnapshot {
  return {
    id: row.id as string,
    companyName: (row.company_name as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as MatchRequirementSnapshot['tenure']) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    budgetMinPence: num(row.budget_min_pence),
    budgetMaxPence: num(row.budget_max_pence),
    notes: (row.notes as string | null) ?? null,
    stage: (row.stage as string) ?? 'new',
    updatedAt: (row.updated_at as string) ?? (row.created_at as string) ?? '',
  };
}

function requirementLabel(req: MatchRequirementSnapshot): string {
  return req.companyName || req.contactName || 'Requirement';
}

function toSuggestion(
  listing: MatchListingSnapshot,
  requirement: MatchRequirementSnapshot,
  score: number,
  reasons: string[],
): MatchSuggestion {
  return {
    listingId: listing.id,
    requirementId: requirement.id,
    score,
    reasons,
    listingName: listing.name,
    listingSector: listing.sector,
    listingTown: listing.town,
    listingDisposalType: listing.disposalType,
    listingSizeMinSqft: listing.sizeMinSqft,
    listingSizeMaxSqft: listing.sizeMaxSqft,
    requirementLabel: requirementLabel(requirement),
    requirementSector: requirement.sector,
    requirementLocationText: requirement.locationText,
    requirementTenure: requirement.tenure,
    requirementSizeMinSqft: requirement.sizeMinSqft,
    requirementSizeMaxSqft: requirement.sizeMaxSqft,
    requirementUpdatedAt: requirement.updatedAt,
  };
}

const LISTING_SELECT =
  'id, name, sector, disposal_type, town, postcode, address_line1, size_min_sqft, size_max_sqft, asking_rent_pence, asking_rent_to_pence, asking_price_pence, status';

const REQUIREMENT_SELECT =
  'id, company_name, contact_name, sector, tenure, location_text, size_min_sqft, size_max_sqft, budget_min_pence, budget_max_pence, notes, stage, updated_at, created_at';

export function createMatchSuggestionsService(client: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  async function existingPairs(
    accountId: string,
    listingIds?: string[],
    requirementIds?: string[],
  ): Promise<Set<string>> {
    let query = db
      .from('commercial_matches')
      .select('listing_id, requirement_id')
      .eq('account_id', accountId);

    if (listingIds?.length === 1) {
      query = query.eq('listing_id', listingIds[0]);
    } else if (listingIds && listingIds.length > 1) {
      query = query.in('listing_id', listingIds);
    }

    if (requirementIds?.length === 1) {
      query = query.eq('requirement_id', requirementIds[0]);
    } else if (requirementIds && requirementIds.length > 1) {
      query = query.in('requirement_id', requirementIds);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[match-suggestions] existingPairs', error.message);
      return new Set();
    }

    return new Set(
      (
        (data ?? []) as Array<{ listing_id: string; requirement_id: string }>
      ).map((row) => `${row.listing_id}:${row.requirement_id}`),
    );
  }

  return {
    async suggestForListing(input: {
      accountId: string;
      listingId: string;
      minScore?: number;
      limit?: number;
    }): Promise<MatchSuggestion[]> {
      const minScore = input.minScore ?? DEFAULT_MATCH_SUGGESTION_MIN_SCORE;
      const limit = input.limit ?? 12;

      const [
        { data: listingRow, error: listingError },
        { data: reqRows, error: reqError },
      ] = await Promise.all([
        db
          .from('commercial_listings')
          .select(LISTING_SELECT)
          .eq('id', input.listingId)
          .eq('account_id', input.accountId)
          .maybeSingle(),
        db
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('account_id', input.accountId)
          .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
          .order('updated_at', { ascending: false })
          .limit(250),
      ]);

      if (listingError || !listingRow) {
        if (listingError) {
          console.error('[match-suggestions] listing', listingError.message);
        }
        return [];
      }
      if (reqError) {
        console.error('[match-suggestions] requirements', reqError.message);
        return [];
      }

      const listing = mapListing(listingRow as Record<string, unknown>);
      const existing = await existingPairs(input.accountId, [input.listingId]);

      const scored = ((reqRows ?? []) as Array<Record<string, unknown>>)
        .map(mapRequirement)
        .filter((req) => !existing.has(`${listing.id}:${req.id}`))
        .map((req) => {
          const result = scoreListingRequirementMatch(listing, req);
          return toSuggestion(listing, req, result.score, result.reasons);
        })
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    },

    async suggestForRequirement(input: {
      accountId: string;
      requirementId: string;
      minScore?: number;
      limit?: number;
    }): Promise<MatchSuggestion[]> {
      const minScore = input.minScore ?? DEFAULT_MATCH_SUGGESTION_MIN_SCORE;
      const limit = input.limit ?? 12;

      const [
        { data: reqRow, error: reqError },
        { data: listingRows, error: listingError },
      ] = await Promise.all([
        db
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('id', input.requirementId)
          .eq('account_id', input.accountId)
          .maybeSingle(),
        db
          .from('commercial_listings')
          .select(LISTING_SELECT)
          .eq('account_id', input.accountId)
          .in('status', [...ACTIVE_LISTING_STATUSES_FOR_MATCH])
          .order('updated_at', { ascending: false })
          .limit(250),
      ]);

      if (reqError || !reqRow) {
        if (reqError) {
          console.error('[match-suggestions] requirement', reqError.message);
        }
        return [];
      }
      if (listingError) {
        console.error('[match-suggestions] listings', listingError.message);
        return [];
      }

      const requirement = mapRequirement(reqRow as Record<string, unknown>);
      const existing = await existingPairs(input.accountId, undefined, [
        input.requirementId,
      ]);

      return ((listingRows ?? []) as Array<Record<string, unknown>>)
        .map(mapListing)
        .filter((listing) => !existing.has(`${listing.id}:${requirement.id}`))
        .map((listing) => {
          const result = scoreListingRequirementMatch(listing, requirement);
          return toSuggestion(
            listing,
            requirement,
            result.score,
            result.reasons,
          );
        })
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },

    async deskDigest(input: {
      accountId: string;
      minScore?: number;
      limit?: number;
      requirementDays?: number;
    }): Promise<{
      count: number;
      suggestions: MatchSuggestion[];
    }> {
      const minScore = input.minScore ?? DEFAULT_MATCH_SUGGESTION_MIN_SCORE;
      const limit = input.limit ?? 8;
      const requirementDays = input.requirementDays ?? 30;
      const cutoff = new Date(
        Date.now() - requirementDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [
        { data: listingRows, error: listingError },
        { data: reqRows, error: reqError },
      ] = await Promise.all([
        db
          .from('commercial_listings')
          .select(LISTING_SELECT)
          .eq('account_id', input.accountId)
          .in('status', [...ACTIVE_LISTING_STATUSES_FOR_MATCH])
          .order('updated_at', { ascending: false })
          .limit(80),
        db
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('account_id', input.accountId)
          .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
          .gte('updated_at', cutoff)
          .order('updated_at', { ascending: false })
          .limit(80),
      ]);

      if (listingError || reqError) {
        console.error(
          '[match-suggestions] digest',
          listingError?.message ?? reqError?.message,
        );
        return { count: 0, suggestions: [] };
      }

      const listings = (
        (listingRows ?? []) as Array<Record<string, unknown>>
      ).map(mapListing);
      const requirements = (
        (reqRows ?? []) as Array<Record<string, unknown>>
      ).map(mapRequirement);

      if (listings.length === 0 || requirements.length === 0) {
        return { count: 0, suggestions: [] };
      }

      const existing = await existingPairs(
        input.accountId,
        listings.map((l) => l.id),
        requirements.map((r) => r.id),
      );

      const scored: MatchSuggestion[] = [];
      for (const listing of listings) {
        for (const requirement of requirements) {
          if (existing.has(`${listing.id}:${requirement.id}`)) continue;
          const result = scoreListingRequirementMatch(listing, requirement);
          if (result.score < minScore) continue;
          scored.push(
            toSuggestion(listing, requirement, result.score, result.reasons),
          );
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, limit);
      return { count: scored.length, suggestions: top };
    },
  };
}
