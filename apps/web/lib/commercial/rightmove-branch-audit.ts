import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { listingStatusPublishesToPortals } from '~/lib/commercial/commercial-constants';
import type { ListingStatus } from '~/lib/commercial/commercial-constants';
import { recordListingEvent } from '~/lib/commercial/listing-events';
import { rightmoveRemovalReasonForStatus } from '~/lib/commercial/portal-sync-policy';
import {
  RightmoveApiError,
  deleteCommercialProperty,
  listCommercialPropertiesForBranch,
} from '~/lib/commercial/rightmove-api';
import {
  type RightmoveAuditListing,
  type RightmoveBranchPropertyKind,
  type RightmoveReferenceIndex,
  classifyRightmoveReference,
  extractRightmoveBranchProperties,
  readRightmoveBranchTotalPages,
  rightmoveBranchPropertyRemovable,
} from '~/lib/commercial/rightmove-branch-audit-shared';

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

export type RightmoveBranchAuditItem = {
  reference: string;
  displayUrl: string | null;
  kind: RightmoveBranchPropertyKind;
  listing: RightmoveAuditListing | null;
  removable: boolean;
};

export type RightmoveBranchAudit = {
  accountBranchId: string;
  branchName: string;
  rightmoveBranchId: number;
  items: RightmoveBranchAuditItem[];
  error: string | null;
  /** Start of Rightmove's response when nothing could be read from it. */
  unreadableSample: string | null;
};

function parseBranchId(value: string | null): number | null {
  const n = Number(value?.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Everything Ozer knows about Rightmove references for this workspace. */
async function loadReferenceIndex(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveReferenceIndex> {
  const [
    { data: listings, error: listingsError },
    { data: pubs, error: pubsError },
  ] = await Promise.all([
    client
      .from('commercial_listings')
      .select('id, name, status, external_id, disposal_type')
      .eq('account_id', accountId),
    client
      .from('commercial_portal_publications')
      .select('listing_id, status, external_id, metadata')
      .eq('account_id', accountId)
      .eq('portal', 'rightmove'),
  ]);
  if (listingsError) throw new Error(listingsError.message);
  if (pubsError) throw new Error(pubsError.message);

  const listingById = new Map<string, RightmoveAuditListing>();
  const dualListingIds = new Set<string>();
  const katoReferences = new Map<string, RightmoveAuditListing>();
  for (const row of (listings ?? []) as Array<Record<string, unknown>>) {
    const listing = {
      id: String(row.id),
      name: ((row.name as string | null) ?? '').trim() || 'Untitled',
      status: String(row.status ?? ''),
    };
    listingById.set(listing.id, listing);
    if (row.disposal_type === 'to_let_and_for_sale') {
      dualListingIds.add(listing.id);
    }
    const kato = (row.external_id as string | null)?.trim();
    if (kato) katoReferences.set(kato, listing);
  }

  const ozerReferences: RightmoveReferenceIndex['ozerReferences'] = new Map();
  for (const pub of (pubs ?? []) as Array<Record<string, unknown>>) {
    const listing = listingById.get(String(pub.listing_id));
    if (!listing) continue;
    const lettingsLive =
      listingStatusPublishesToPortals(listing.status) &&
      pub.status !== 'unpublished';
    const reference = (pub.external_id as string | null)?.trim() || listing.id;
    ozerReferences.set(reference, { listing, intendedLive: lettingsLive });

    const sale = (pub.metadata as Record<string, unknown> | null)
      ?.rightmoveSale as Record<string, unknown> | undefined;
    if (sale && typeof sale.reference === 'string' && sale.reference) {
      ozerReferences.set(sale.reference, {
        listing,
        intendedLive:
          lettingsLive &&
          dualListingIds.has(listing.id) &&
          sale.status !== 'unpublished',
      });
    }
  }

  // A Kato id that is also an Ozer reference is Ozer's, not a Kato copy.
  for (const reference of ozerReferences.keys()) {
    katoReferences.delete(reference);
  }

  return { ozerReferences, katoReferences };
}

async function listBranch(rightmoveBranchId: number): Promise<{
  properties: ReturnType<typeof extractRightmoveBranchProperties>;
  unreadableSample: string | null;
}> {
  const seen = new Map<
    string,
    ReturnType<typeof extractRightmoveBranchProperties>[number]
  >();
  let firstRaw: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { json, raw } = await listCommercialPropertiesForBranch({
      branchId: rightmoveBranchId,
      page,
      size: PAGE_SIZE,
    });
    if (firstRaw == null) firstRaw = raw;

    const found = extractRightmoveBranchProperties(json);
    let added = 0;
    for (const property of found) {
      if (seen.has(property.reference)) continue;
      seen.set(property.reference, property);
      added++;
    }

    const totalPages = readRightmoveBranchTotalPages(json);
    const lastPage =
      totalPages != null ? page + 1 >= totalPages : found.length < PAGE_SIZE;
    // A page with nothing new means Rightmove is repeating itself.
    if (lastPage || added === 0) break;
  }

  const properties = [...seen.values()];
  const looksEmpty =
    !firstRaw || /^\s*(\{\s*\}|\[\s*\]|null)?\s*$/.test(firstRaw);
  return {
    properties,
    unreadableSample:
      properties.length === 0 && !looksEmpty
        ? (firstRaw ?? '').slice(0, 1500)
        : null,
  };
}

/**
 * Compare what Rightmove holds for each of the workspace's branches with
 * what Ozer publishes, so properties Ozer has no record of (usually left over
 * from a previous feed provider) can be found and removed.
 */
export async function auditRightmoveBranches(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveBranchAudit[]> {
  const [branches, index] = await Promise.all([
    loadAccountBranches(accountId),
    loadReferenceIndex(client, accountId),
  ]);

  const audits: RightmoveBranchAudit[] = [];
  for (const branch of branches) {
    const rightmoveBranchId = parseBranchId(branch.rightmoveBranchId);
    if (rightmoveBranchId == null) continue;

    const base = {
      accountBranchId: branch.id,
      branchName: branch.name,
      rightmoveBranchId,
    };
    try {
      const { properties, unreadableSample } =
        await listBranch(rightmoveBranchId);
      audits.push({
        ...base,
        items: properties.map((property) => {
          const { kind, listing } = classifyRightmoveReference(
            property.reference,
            index,
          );
          return {
            ...property,
            kind,
            listing,
            removable: rightmoveBranchPropertyRemovable(kind),
          };
        }),
        error: null,
        unreadableSample,
      });
    } catch (err) {
      audits.push({
        ...base,
        items: [],
        error: err instanceof Error ? err.message : 'Rightmove request failed',
        unreadableSample: null,
      });
    }
  }
  return audits;
}

/**
 * Remove one property from a branch. Refuses references Ozer is currently
 * publishing for an on-market disposal; those are managed by the normal sync.
 */
export async function removeRightmoveBranchProperty(input: {
  client: SupabaseClient;
  accountId: string;
  rightmoveBranchId: number;
  reference: string;
  actorUserId: string;
}): Promise<{ alreadyGone: boolean }> {
  const [branches, index] = await Promise.all([
    loadAccountBranches(input.accountId),
    loadReferenceIndex(input.client, input.accountId),
  ]);
  const ownsBranch = branches.some(
    (b) => parseBranchId(b.rightmoveBranchId) === input.rightmoveBranchId,
  );
  if (!ownsBranch) {
    throw new Error('That Rightmove branch is not set up in this workspace');
  }

  const { kind, listing } = classifyRightmoveReference(input.reference, index);
  if (!rightmoveBranchPropertyRemovable(kind)) {
    throw new Error(
      'Ozer is publishing this disposal. Turn off Rightmove on the disposal instead.',
    );
  }

  const removalReason = listing
    ? rightmoveRemovalReasonForStatus(listing.status as ListingStatus)
    : 'REMOVED';

  let alreadyGone = false;
  try {
    await deleteCommercialProperty({
      reference: input.reference,
      agentId: input.rightmoveBranchId,
      removalReason,
    });
  } catch (err) {
    if (err instanceof RightmoveApiError && err.status === 404) {
      alreadyGone = true;
    } else {
      throw err;
    }
  }

  console.info('[rightmove-branch-audit] removed property', {
    accountId: input.accountId,
    rightmoveBranchId: input.rightmoveBranchId,
    reference: input.reference,
    kind,
    removalReason,
    alreadyGone,
  });

  if (listing) {
    await recordListingEvent(input.client, {
      accountId: input.accountId,
      listingId: listing.id,
      actorUserId: input.actorUserId,
      eventType: 'portal_sync',
      summary:
        kind === 'kato_copy'
          ? `Removed old Kato copy (${input.reference}) from Rightmove`
          : `Removed leftover Rightmove property (${input.reference})`,
      metadata: {
        portal: 'rightmove',
        reference: input.reference,
        removalReason,
        alreadyGone,
      },
    });
  }

  return { alreadyGone };
}
