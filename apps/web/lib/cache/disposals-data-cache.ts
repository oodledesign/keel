import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { CommercialListing } from '~/home/[account]/listings/_lib/server/listings.service';
import { createListingsService } from '~/home/[account]/listings/_lib/server/listings.service';
import {
  LISTING_ACTIVE_STATUSES,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';

import {
  disposalsAccountTag,
  disposalsDetailTag,
  disposalsListTag,
  matchRequirementsTag,
} from './disposals-cache-tags';

const LIST_REVALIDATE_SECONDS = 45;
const DETAIL_REVALIDATE_SECONDS = 45;
const MATCH_REQS_REVALIDATE_SECONDS = 90;

function revalidateTagCompat(tag: string) {
  // Next 16 prefers a cacheLife profile as the second argument.
  revalidateTag(tag, 'max');
}

export function revalidateAccountBranchesCache(accountId: string) {
  revalidateTagCompat(`account-branches:${accountId}`);
}

export function revalidateDisposalsCaches(input: {
  accountId: string;
  userId?: string;
  listingId?: string;
}) {
  revalidateTagCompat(disposalsAccountTag(input.accountId));
  if (input.userId) {
    revalidateTagCompat(disposalsListTag(input.accountId, input.userId));
  }
  if (input.listingId && input.userId) {
    revalidateTagCompat(disposalsDetailTag(input.listingId, input.userId));
  }
}

export function revalidateMatchRequirementsCache(accountId: string) {
  revalidateTagCompat(matchRequirementsTag(accountId));
}

/**
 * First-page disposals list for SSR. Uses the admin client inside the cache
 * (cookies are unavailable in unstable_cache). Caller must verify membership.
 *
 * Suggested match scoring is deferred (includeSuggestedMatches: false).
 */
export function getCachedDisposalsListPage(input: {
  accountId: string;
  userId: string;
  accountBranchId: string | null;
  status?: ListingStatus;
  statuses?: ListingStatus[];
  actingAgentUserId?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ data: CommercialListing[]; total: number }> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const officeKey = input.accountBranchId ?? 'all';
  const hasExplicitStatuses = input.statuses != null;
  const hasSingleStatus = Boolean(input.status);
  const statuses = hasExplicitStatuses
    ? input.statuses
    : hasSingleStatus
      ? undefined
      : [...LISTING_ACTIVE_STATUSES];
  const statusKey = hasSingleStatus
    ? `one:${input.status}`
    : hasExplicitStatuses
      ? (input.statuses ?? []).join(',') || 'none'
      : statuses!.join(',');
  const agentKey = input.actingAgentUserId ?? 'all';

  return unstable_cache(
    async () => {
      const admin = getSupabaseServerAdminClient();
      return createListingsService(admin).listListingsPage({
        accountId: input.accountId,
        accountBranchId: input.accountBranchId,
        status: input.status,
        statuses,
        actingAgentUserId: input.actingAgentUserId,
        page,
        pageSize,
        includeSuggestedMatches: false,
      });
    },
    [
      'disposals-list',
      input.accountId,
      input.userId,
      officeKey,
      statusKey,
      agentKey,
      String(page),
      String(pageSize),
    ],
    {
      revalidate: LIST_REVALIDATE_SECONDS,
      tags: [
        disposalsAccountTag(input.accountId),
        disposalsListTag(input.accountId, input.userId),
      ],
    },
  )();
}

export function getCachedDisposalDetail(input: {
  accountId: string;
  userId: string;
  listingId: string;
}): Promise<CommercialListing | null> {
  return unstable_cache(
    async () => {
      const admin = getSupabaseServerAdminClient();
      return createListingsService(admin).getListing(
        input.listingId,
        input.accountId,
      );
    },
    ['disposals-detail', input.accountId, input.userId, input.listingId],
    {
      revalidate: DETAIL_REVALIDATE_SECONDS,
      tags: [
        disposalsAccountTag(input.accountId),
        disposalsDetailTag(input.listingId, input.userId),
      ],
    },
  )();
}

export function getCachedUnassignedListingsCount(input: {
  accountId: string;
  status?: ListingStatus;
  statuses?: ListingStatus[];
}): Promise<number> {
  const hasExplicitStatuses = input.statuses != null;
  const hasSingleStatus = Boolean(input.status);
  const statuses = hasExplicitStatuses
    ? input.statuses
    : hasSingleStatus
      ? undefined
      : [...LISTING_ACTIVE_STATUSES];
  const statusKey = hasSingleStatus
    ? `one:${input.status}`
    : hasExplicitStatuses
      ? (input.statuses ?? []).join(',') || 'none'
      : statuses!.join(',');

  return unstable_cache(
    async () => {
      const admin = getSupabaseServerAdminClient();
      return createListingsService(admin).countUnassignedListings({
        accountId: input.accountId,
        status: input.status,
        statuses,
      });
    },
    ['disposals-unassigned', input.accountId, statusKey],
    {
      revalidate: LIST_REVALIDATE_SECONDS,
      tags: [disposalsAccountTag(input.accountId)],
    },
  )();
}

type MatchRequirementRow = Record<string, unknown>;

/**
 * Active requirements used for suggestion scoring — shared across the account.
 */
export function getCachedActiveMatchRequirements(input: {
  accountId: string;
  select: string;
  stages: readonly string[];
  limit: number;
}): Promise<MatchRequirementRow[]> {
  const stagesKey = [...input.stages].sort().join(',');
  return unstable_cache(
    async () => {
      const admin = getSupabaseServerAdminClient();
      const { data, error } = await admin
        .from('commercial_requirements')
        .select(input.select)
        .eq('account_id', input.accountId)
        .in('stage', [...input.stages])
        .order('updated_at', { ascending: false })
        .limit(input.limit);

      if (error) {
        console.error('[cache] match-reqs', error.message);
        return [];
      }

      return (data ?? []) as unknown as MatchRequirementRow[];
    },
    [
      'match-reqs',
      input.accountId,
      input.select,
      stagesKey,
      String(input.limit),
    ],
    {
      revalidate: MATCH_REQS_REVALIDATE_SECONDS,
      tags: [matchRequirementsTag(input.accountId)],
    },
  )();
}
