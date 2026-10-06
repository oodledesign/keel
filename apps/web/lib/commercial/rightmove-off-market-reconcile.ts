import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { listingStatusPublishesToPortals } from '~/lib/commercial/commercial-constants';
import {
  setPortalPublishersClient,
  unpublishFromRightmove,
} from '~/lib/commercial/portal-publishers';
import {
  isRightmoveRemovalPending,
  rightmoveRemovalReasonForStatus,
} from '~/lib/commercial/portal-sync-policy';
import { publicationLooksRateLimited } from '~/lib/commercial/rightmove-rate-limit';

export type OffMarketCandidate = {
  accountId: string;
  listingId: string;
  name: string;
  listingStatus: string;
};

export type OffMarketReconcileResult = {
  found: number;
  removed: number;
  failed: number;
  /** Candidates only; set when `dryRun` is true. */
  candidates?: OffMarketCandidate[];
  lastError: string | null;
};

const LOOKAHEAD = 1000;
const CHUNK = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Disposals that are let, sold, withdrawn or draft but that Rightmove may still
 * be showing. Status changes remove them straight away; this catches anything
 * that slipped past (changes made before that existed, imports, a failed call).
 */
export async function listOffMarketRightmoveCandidates(
  client: SupabaseClient,
  options: { accountId?: string; now?: Date } = {},
): Promise<OffMarketCandidate[]> {
  let query = client
    .from('commercial_portal_publications')
    .select('listing_id, account_id, status, metadata, updated_at')
    .eq('portal', 'rightmove')
    .in('status', ['published', 'error'])
    .limit(LOOKAHEAD);
  if (options.accountId) query = query.eq('account_id', options.accountId);

  const { data: pubs, error } = await query;
  if (error) throw new Error(error.message);

  const publications = (pubs ?? []) as Array<Record<string, unknown>>;
  const listingIds = [
    ...new Set(publications.map((p) => String(p.listing_id))),
  ];
  const listingById = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < listingIds.length; i += CHUNK) {
    const { data: listings, error: listingsError } = await client
      .from('commercial_listings')
      .select('id, account_id, name, status')
      .in('id', listingIds.slice(i, i + CHUNK));
    if (listingsError) throw new Error(listingsError.message);
    for (const row of (listings ?? []) as Array<Record<string, unknown>>) {
      listingById.set(String(row.id), row);
    }
  }

  const now = options.now ?? new Date();
  const candidates: OffMarketCandidate[] = [];
  for (const pub of publications) {
    const listing = listingById.get(String(pub.listing_id));
    if (!listing) continue;
    const metadata = (pub.metadata ?? {}) as Record<string, unknown>;
    if (
      !isRightmoveRemovalPending(
        {
          listingStatus: String(listing.status ?? ''),
          publicationStatus: String(pub.status ?? ''),
          stage: typeof metadata.stage === 'string' ? metadata.stage : null,
          updatedAt: (pub.updated_at as string | null) ?? null,
        },
        now,
      )
    ) {
      continue;
    }
    candidates.push({
      accountId: String(listing.account_id ?? pub.account_id),
      listingId: String(listing.id),
      name: ((listing.name as string | null) ?? '').trim() || 'Untitled',
      listingStatus: String(listing.status ?? ''),
    });
  }
  return candidates;
}

/**
 * Take off-market disposals off Rightmove. `limit` keeps one cron run inside
 * Rightmove's rate limit; the rest is picked up on the next run.
 */
export async function reconcileOffMarketRightmove(input: {
  client: SupabaseClient;
  limit?: number;
  delayMs?: number;
  accountId?: string;
  dryRun?: boolean;
}): Promise<OffMarketReconcileResult> {
  const limit = Math.min(40, Math.max(1, input.limit ?? 15));
  const delayMs = Math.max(0, input.delayMs ?? 300);

  const all = await listOffMarketRightmoveCandidates(input.client, {
    accountId: input.accountId,
  });
  const batch = all.slice(0, limit);

  if (input.dryRun) {
    return {
      found: all.length,
      removed: 0,
      failed: 0,
      candidates: all,
      lastError: null,
    };
  }

  let removed = 0;
  let failed = 0;
  let lastError: string | null = null;

  setPortalPublishersClient(input.client);
  try {
    for (let i = 0; i < batch.length; i++) {
      const candidate = batch[i]!;
      try {
        // Re-check just before the delete: someone may have put it back on the
        // market since the scan, and a live listing must never be removed.
        const { data: fresh } = await input.client
          .from('commercial_listings')
          .select('status')
          .eq('id', candidate.listingId)
          .eq('account_id', candidate.accountId)
          .maybeSingle();
        const currentStatus = String(fresh?.status ?? '');
        if (!currentStatus || listingStatusPublishesToPortals(currentStatus)) {
          continue;
        }

        const publication = await unpublishFromRightmove(
          candidate.accountId,
          candidate.listingId,
          rightmoveRemovalReasonForStatus(currentStatus),
        );
        if (publication.status === 'error') {
          failed += 1;
          lastError = publication.last_error ?? 'Rightmove removal failed';
          if (publicationLooksRateLimited(publication)) break;
        } else {
          removed += 1;
        }
      } catch (error) {
        failed += 1;
        lastError =
          error instanceof Error ? error.message : 'Rightmove removal failed';
      }
      if (i < batch.length - 1 && delayMs > 0) await sleep(delayMs);
    }
  } finally {
    setPortalPublishersClient(null);
  }

  return { found: all.length, removed, failed, lastError };
}
