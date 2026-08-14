import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  INTEREST_STATUSES,
  type InterestStatus,
  normalizeInterestStatus,
} from '~/lib/commercial/commercial-constants';
import { recordListingEvent } from '~/lib/commercial/listing-events';

const INTEREST_STATUS_RANK: Record<InterestStatus, number> = Object.fromEntries(
  INTEREST_STATUSES.map((status, index) => [status, index]),
) as Record<InterestStatus, number>;

export type CommercialInterestMatch = {
  id: string;
  accountId: string;
  listingId: string;
  requirementId: string;
  status: InterestStatus;
  notes: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  listingName: string | null;
  listingDisposalType: string | null;
  listingSector: string | null;
  listingSizeMinSqft: number | null;
  listingSizeMaxSqft: number | null;
  requirementCompanyName: string | null;
  requirementContactName: string | null;
  requirementSector: string | null;
  requirementLocationText: string | null;
  requirementSizeMinSqft: number | null;
  requirementSizeMaxSqft: number | null;
};

type Row = Record<string, unknown> & {
  id: string;
  account_id: string;
  listing_id: string;
  requirement_id: string;
  status: string;
  notes: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  commercial_listings?: Record<string, unknown> | null;
  commercial_requirements?: Record<string, unknown> | null;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapMatch(row: Row): CommercialInterestMatch {
  const listing = (row.commercial_listings ?? null) as Record<
    string,
    unknown
  > | null;
  const requirement = (row.commercial_requirements ?? null) as Record<
    string,
    unknown
  > | null;

  return {
    id: row.id,
    accountId: row.account_id,
    listingId: row.listing_id,
    requirementId: row.requirement_id,
    status: normalizeInterestStatus(row.status),
    notes: row.notes,
    lastActivityAt: row.last_activity_at || row.updated_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    listingName: (listing?.name as string | null) ?? null,
    listingDisposalType: (listing?.disposal_type as string | null) ?? null,
    listingSector: (listing?.sector as string | null) ?? null,
    listingSizeMinSqft: num(listing?.size_min_sqft),
    listingSizeMaxSqft: num(listing?.size_max_sqft),
    requirementCompanyName:
      (requirement?.company_name as string | null) ?? null,
    requirementContactName:
      (requirement?.contact_name as string | null) ?? null,
    requirementSector: (requirement?.sector as string | null) ?? null,
    requirementLocationText:
      (requirement?.location_text as string | null) ?? null,
    requirementSizeMinSqft: num(requirement?.size_min_sqft),
    requirementSizeMaxSqft: num(requirement?.size_max_sqft),
  };
}

const MATCH_SELECT = `
  id, account_id, listing_id, requirement_id, status, notes,
  last_activity_at, created_at, updated_at,
  commercial_listings ( name, disposal_type, sector, size_min_sqft, size_max_sqft ),
  commercial_requirements ( company_name, contact_name, sector, location_text, size_min_sqft, size_max_sqft )
`;

function withinLastDays(iso: string, lastDays?: number) {
  if (!lastDays) return true;
  const cutoff = Date.now() - lastDays * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

function matchesSizeFilter(
  row: CommercialInterestMatch,
  sizeMinSqft?: number | null,
  sizeMaxSqft?: number | null,
) {
  if (sizeMinSqft == null && sizeMaxSqft == null) return true;
  const reqMin = row.requirementSizeMinSqft;
  const reqMax = row.requirementSizeMaxSqft;
  if (reqMin == null && reqMax == null) return true;
  const bandMin = sizeMinSqft ?? 0;
  const bandMax = sizeMaxSqft ?? Number.POSITIVE_INFINITY;
  const value = reqMax ?? reqMin ?? 0;
  return value >= bandMin && value <= bandMax;
}

export function createMatchesService(client: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  /**
   * Create interest if missing; optionally promote status (e.g. viewing).
   * Safe for auto-link from viewings/enquiries (idempotent).
   */
  async function ensureMatch(input: {
    accountId: string;
    listingId: string;
    requirementId: string;
    status?: InterestStatus;
    notes?: string | null;
    createdBy?: string | null;
    /** When existing match is earlier in the funnel, promote to this status. */
    promoteStatus?: InterestStatus;
  }): Promise<{ match: CommercialInterestMatch; created: boolean }> {
    const [{ data: listing }, { data: requirement }, { data: existing }] =
      await Promise.all([
        db
          .from('commercial_listings')
          .select('id')
          .eq('id', input.listingId)
          .eq('account_id', input.accountId)
          .maybeSingle(),
        db
          .from('commercial_requirements')
          .select('id')
          .eq('id', input.requirementId)
          .eq('account_id', input.accountId)
          .maybeSingle(),
        db
          .from('commercial_matches')
          .select(MATCH_SELECT)
          .eq('account_id', input.accountId)
          .eq('listing_id', input.listingId)
          .eq('requirement_id', input.requirementId)
          .maybeSingle(),
      ]);

    if (!listing || !requirement) {
      throw new Error('Listing and requirement must belong to this account');
    }

    if (existing) {
      const current = mapMatch(existing as Row);
      const promote = input.promoteStatus ?? input.status;
      if (
        promote &&
        INTEREST_STATUS_RANK[promote] > INTEREST_STATUS_RANK[current.status]
      ) {
        const { data, error } = await db
          .from('commercial_matches')
          .update({
            status: promote,
            updated_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', current.id)
          .eq('account_id', input.accountId)
          .select(MATCH_SELECT)
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to update interest');
        }
        const promoted = mapMatch(data as Row);
        try {
          await recordListingEvent(client, {
            accountId: input.accountId,
            listingId: input.listingId,
            actorUserId: input.createdBy ?? null,
            eventType: 'match_updated',
            summary: `Interest updated to ${promoted.status}`,
            metadata: {
              matchId: promoted.id,
              requirementId: promoted.requirementId,
              status: promoted.status,
              previousStatus: current.status,
            },
          });
        } catch {
          /* best-effort */
        }
        return { match: promoted, created: false };
      }
      return { match: current, created: false };
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from('commercial_matches')
      .insert({
        account_id: input.accountId,
        listing_id: input.listingId,
        requirement_id: input.requirementId,
        status: input.status ?? input.promoteStatus ?? 'new',
        notes: input.notes?.trim() || null,
        created_by: input.createdBy ?? null,
        last_activity_at: now,
        updated_at: now,
      })
      .select(MATCH_SELECT)
      .single();

    if (error) {
      // Unique race: fetch existing
      if (
        String(error.message ?? '').includes('duplicate') ||
        error.code === '23505'
      ) {
        const { data: raced } = await db
          .from('commercial_matches')
          .select(MATCH_SELECT)
          .eq('account_id', input.accountId)
          .eq('listing_id', input.listingId)
          .eq('requirement_id', input.requirementId)
          .maybeSingle();
        if (raced) {
          return { match: mapMatch(raced as Row), created: false };
        }
      }
      throw new Error(error.message ?? 'Failed to create interest');
    }

    if (!data) {
      throw new Error('Failed to create interest');
    }

    const createdMatch = mapMatch(data as Row);
    try {
      await recordListingEvent(client, {
        accountId: input.accountId,
        listingId: input.listingId,
        actorUserId: input.createdBy ?? null,
        eventType: 'match_added',
        summary: `Interest added (${createdMatch.status})`,
        metadata: {
          matchId: createdMatch.id,
          requirementId: createdMatch.requirementId,
          status: createdMatch.status,
        },
      });
    } catch {
      /* best-effort */
    }

    return { match: createdMatch, created: true };
  }

  return {
    async listForListing(input: {
      accountId: string;
      listingId: string;
      lastDays?: number;
      sector?: string | null;
      sizeMinSqft?: number | null;
      sizeMaxSqft?: number | null;
    }): Promise<CommercialInterestMatch[]> {
      const { data, error } = await db
        .from('commercial_matches')
        .select(MATCH_SELECT)
        .eq('account_id', input.accountId)
        .eq('listing_id', input.listingId)
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('[matches] listForListing', error.message);
        return [];
      }

      const sector = input.sector?.trim().toLowerCase();
      return ((data ?? []) as Row[])
        .map(mapMatch)
        .filter((row) => withinLastDays(row.lastActivityAt, input.lastDays))
        .filter((row) =>
          sector
            ? (row.requirementSector ?? '').toLowerCase().includes(sector)
            : true,
        )
        .filter((row) =>
          matchesSizeFilter(row, input.sizeMinSqft, input.sizeMaxSqft),
        );
    },

    async listForRequirement(input: {
      accountId: string;
      requirementId: string;
      lastDays?: number;
    }): Promise<CommercialInterestMatch[]> {
      const { data, error } = await db
        .from('commercial_matches')
        .select(MATCH_SELECT)
        .eq('account_id', input.accountId)
        .eq('requirement_id', input.requirementId)
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('[matches] listForRequirement', error.message);
        return [];
      }

      return ((data ?? []) as Row[])
        .map(mapMatch)
        .filter((row) => withinLastDays(row.lastActivityAt, input.lastDays));
    },

    async createMatch(input: {
      accountId: string;
      listingId: string;
      requirementId: string;
      status?: InterestStatus;
      notes?: string | null;
      createdBy?: string | null;
    }): Promise<CommercialInterestMatch> {
      const ensured = await ensureMatch(input);
      return ensured.match;
    },

    ensureMatch,

    async updateMatch(input: {
      accountId: string;
      matchId: string;
      status?: InterestStatus;
      notes?: string | null;
    }): Promise<CommercialInterestMatch> {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };
      if (input.status !== undefined) patch.status = input.status;
      if (input.notes !== undefined) {
        patch.notes = input.notes?.trim() || null;
      }

      const { data, error } = await db
        .from('commercial_matches')
        .update(patch)
        .eq('id', input.matchId)
        .eq('account_id', input.accountId)
        .select(MATCH_SELECT)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update interest');
      }

      const updated = mapMatch(data as Row);
      try {
        await recordListingEvent(client, {
          accountId: input.accountId,
          listingId: updated.listingId,
          eventType: 'match_updated',
          summary: input.status
            ? `Interest status → ${updated.status}`
            : 'Interest notes updated',
          metadata: {
            matchId: updated.id,
            requirementId: updated.requirementId,
            status: updated.status,
          },
        });
      } catch {
        /* best-effort */
      }

      return updated;
    },

    async deleteMatch(matchId: string, accountId: string): Promise<void> {
      const { error } = await db
        .from('commercial_matches')
        .delete()
        .eq('id', matchId)
        .eq('account_id', accountId);

      if (error) throw new Error(error.message);
    },
  };
}
