'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  draftMatchOutreach,
  explainMatchSuggestions,
} from '~/lib/commercial/ai-match';

import {
  BulkCreateInterestMatchesSchema,
  CreateMatchSchema,
  DeleteMatchSchema,
  DraftMatchOutreachSchema,
  ExplainSuggestionsSchema,
  ListMatchesForListingSchema,
  ListMatchesForRequirementSchema,
  MatchDigestSchema,
  RankBookForRequirementSchema,
  SuggestMatchesSchema,
  UpdateMatchSchema,
} from '../schema/matches.schema';
import { createMatchSuggestionsService } from './match-suggestions.service';
import type { MatchSuggestion } from './match-suggestions.service';
import { createMatchesService } from './matches.service';

function getService() {
  return createMatchesService(getSupabaseServerClient());
}

function getSuggestionsService() {
  return createMatchSuggestionsService(getSupabaseServerClient());
}

export const listMatchesForListing = enhanceAction(
  async (input) => getService().listForListing(input),
  { schema: ListMatchesForListingSchema },
);

export const listMatchesForRequirement = enhanceAction(
  async (input) => getService().listForRequirement(input),
  { schema: ListMatchesForRequirementSchema },
);

export const createInterestMatch = enhanceAction(
  async (input, user) => {
    const match = await getService().createMatch({
      ...input,
      createdBy: user.id,
    });
    revalidatePath('/home', 'layout');
    return match;
  },
  { schema: CreateMatchSchema },
);

export const updateInterestMatch = enhanceAction(
  async (input) => {
    const match = await getService().updateMatch(input);
    revalidatePath('/home', 'layout');
    return match;
  },
  { schema: UpdateMatchSchema },
);

export const deleteInterestMatch = enhanceAction(
  async (input) => {
    await getService().deleteMatch(input.matchId, input.accountId);
    revalidatePath('/home', 'layout');
    return { ok: true as const };
  },
  { schema: DeleteMatchSchema },
);

export const suggestInterestMatches = enhanceAction(
  async (input) => {
    const service = getSuggestionsService();
    let suggestions: MatchSuggestion[] = [];

    if (input.listingId) {
      suggestions = await service.suggestForListing({
        accountId: input.accountId,
        listingId: input.listingId,
        minScore: input.minScore,
        limit: input.limit,
      });
    } else if (input.requirementId) {
      suggestions = await service.suggestForRequirement({
        accountId: input.accountId,
        requirementId: input.requirementId,
        minScore: input.minScore,
        limit: input.limit,
      });
    }

    if (input.withAi && suggestions.length > 0) {
      const client = getSupabaseServerClient();
      suggestions = await explainMatchSuggestions({
        accountId: input.accountId,
        supabase: client,
        suggestions,
        mode: input.aiMode ?? 'explain',
      });
    }

    return suggestions;
  },
  { schema: SuggestMatchesSchema },
);

export const explainInterestSuggestions = enhanceAction(
  async (input) => {
    const service = getSuggestionsService();
    let suggestions: MatchSuggestion[] = [];

    if (input.listingId) {
      suggestions = await service.suggestForListing({
        accountId: input.accountId,
        listingId: input.listingId,
        minScore: input.minScore,
        limit: input.limit ?? 8,
      });
    } else if (input.requirementId) {
      suggestions = await service.suggestForRequirement({
        accountId: input.accountId,
        requirementId: input.requirementId,
        minScore: input.minScore,
        limit: input.limit ?? 8,
      });
    }

    if (suggestions.length === 0) return [];

    try {
      return await explainMatchSuggestions({
        accountId: input.accountId,
        supabase: getSupabaseServerClient(),
        suggestions,
        mode: input.mode,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI explain failed';
      console.error('[explainInterestSuggestions]', message);
      throw new Error(
        message.includes('credit')
          ? message
          : 'Could not explain fits right now. Please try again in a moment.',
      );
    }
  },
  { schema: ExplainSuggestionsSchema },
);

export const getInterestMatchDigest = enhanceAction(
  async (input) => getSuggestionsService().deskDigest(input),
  { schema: MatchDigestSchema },
);

export const rankBookForRequirement = enhanceAction(
  async (input) => {
    const suggestions = await getSuggestionsService().suggestForRequirement({
      accountId: input.accountId,
      requirementId: input.requirementId,
      minScore: input.minScore,
      limit: 40,
    });

    if (!input.withAi || suggestions.length === 0) {
      return suggestions;
    }

    return explainMatchSuggestions({
      accountId: input.accountId,
      supabase: getSupabaseServerClient(),
      suggestions,
      mode: 'triage',
    });
  },
  { schema: RankBookForRequirementSchema },
);

export const bulkCreateInterestMatches = enhanceAction(
  async (input, user) => {
    const service = getService();
    const created: Awaited<ReturnType<typeof service.ensureMatch>>[] = [];
    let createdCount = 0;
    let existingCount = 0;

    for (const listingId of input.listingIds) {
      const result = await service.ensureMatch({
        accountId: input.accountId,
        listingId,
        requirementId: input.requirementId,
        notes: input.notes ?? null,
        createdBy: user.id,
        status: 'new',
      });
      created.push(result);
      if (result.created) createdCount += 1;
      else existingCount += 1;
    }

    revalidatePath('/home', 'layout');
    return {
      ok: true as const,
      createdCount,
      existingCount,
      matches: created.map((r) => r.match),
    };
  },
  { schema: BulkCreateInterestMatchesSchema },
);

export const draftInterestOutreach = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;

    const [{ data: listingRow }, { data: requirementRow }] = await Promise.all([
      db
        .from('commercial_listings')
        .select(
          'id, name, sector, disposal_type, town, size_min_sqft, size_max_sqft',
        )
        .eq('id', input.listingId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
      db
        .from('commercial_requirements')
        .select(
          'id, company_name, contact_name, sector, tenure, location_text, size_min_sqft, size_max_sqft',
        )
        .eq('id', input.requirementId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
    ]);

    if (!listingRow || !requirementRow) {
      throw new Error('Listing and requirement must belong to this account');
    }

    const listing = listingRow as Record<string, unknown>;
    const requirement = requirementRow as Record<string, unknown>;

    const suggestion: MatchSuggestion = {
      listingId: input.listingId,
      requirementId: input.requirementId,
      score: input.score ?? 0,
      reasons: input.reasons ?? [],
      listingName: (listing.name as string) || 'Disposal',
      listingSector: (listing.sector as string | null) ?? null,
      listingTown: (listing.town as string | null) ?? null,
      listingDisposalType:
        (listing.disposal_type as MatchSuggestion['listingDisposalType']) ??
        'to_let',
      listingSizeMinSqft:
        listing.size_min_sqft == null ? null : Number(listing.size_min_sqft),
      listingSizeMaxSqft:
        listing.size_max_sqft == null ? null : Number(listing.size_max_sqft),
      listingLatitude: null,
      listingLongitude: null,
      requirementLabel:
        (requirement.company_name as string | null) ||
        (requirement.contact_name as string | null) ||
        'Requirement',
      requirementSector: (requirement.sector as string | null) ?? null,
      requirementLocationText:
        (requirement.location_text as string | null) ?? null,
      requirementTenure:
        (requirement.tenure as MatchSuggestion['requirementTenure']) ?? null,
      requirementSizeMinSqft:
        requirement.size_min_sqft == null
          ? null
          : Number(requirement.size_min_sqft),
      requirementSizeMaxSqft:
        requirement.size_max_sqft == null
          ? null
          : Number(requirement.size_max_sqft),
      requirementUpdatedAt: new Date().toISOString(),
      aiWhyFit: input.aiWhyFit ?? null,
    };

    return draftMatchOutreach({
      accountId: input.accountId,
      supabase: client,
      suggestion,
    });
  },
  { schema: DraftMatchOutreachSchema },
);
