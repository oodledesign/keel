import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type {
  DisposalType,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  deleteCommercialProperty,
  putCommercialProperty,
} from '~/lib/commercial/rightmove-api';
import {
  getRightmoveEnv,
  isRightmoveOAuthConfigured,
} from '~/lib/commercial/rightmove-env';
import {
  mapListingToRightmovePayload,
  resolveRightmovePropertyReference,
  type RightmoveMapperListing,
  type RightmoveMapperMedia,
  type RightmoveMapperUnit,
} from '~/lib/commercial/rightmove-mapper';
import type { RightmoveRemovalReason } from '~/lib/commercial/rightmove-types';

type CommercialPortal = 'property_hive' | 'rightmove' | 'each' | 'other';
type PublicationStatus = 'draft' | 'published' | 'unpublished' | 'error';

export type CommercialPortalPublication = {
  id: string;
  account_id: string;
  listing_id: string;
  portal: CommercialPortal;
  external_id: string | null;
  external_url: string | null;
  branch_ref: string | null;
  status: PublicationStatus;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Media signed URL TTL for portal fetchers (Rightmove HEAD/ETag). */
const RIGHTMOVE_MEDIA_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Untyped until `pnpm supabase:web:typegen` includes commercial_* tables. */
function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
}

async function loadListingForPortalValidation(
  accountId: string,
  listingId: string,
) {
  const { data, error } = await db()
    .from('commercial_listings')
    .select(
      'id, account_id, name, postcode, disposal_type, asking_rent_pence, asking_price_pence, size_min_sqft, size_max_sqft, address_line_1, town, status',
    )
    .eq('id', listingId)
    .eq('account_id', accountId)
    .single();

  if (error) throw new Error(error.message);
  return data as {
    id: string;
    account_id: string;
    name: string;
    postcode: string | null;
    disposal_type: string;
    asking_rent_pence: number | null;
    asking_price_pence: number | null;
    size_min_sqft: number | null;
    size_max_sqft: number | null;
    address_line_1: string | null;
    town: string | null;
    status: string;
  };
}

async function loadListingForRightmove(
  accountId: string,
  listingId: string,
): Promise<RightmoveMapperListing> {
  const { data, error } = await db()
    .from('commercial_listings')
    .select(
      `
      id, name, address_line_1, address_line_2, town, postcode,
      latitude, longitude, sector, tenure, disposal_type, status,
      asking_rent_pence, asking_price_pence, rent_frequency,
      hide_rent_from_marketing, size_min_sqft, size_max_sqft,
      measurement_standard, use_class, available_from, epc_rating,
      breeam_rating, summary, description, key_points, reference_number
    `,
    )
    .eq('id', listingId)
    .eq('account_id', accountId)
    .single();

  if (error) throw new Error(error.message);

  const keyPointsRaw = data.key_points;
  const keyPoints = Array.isArray(keyPointsRaw)
    ? keyPointsRaw
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object' && 'text' in item) {
            return String((item as { text: unknown }).text ?? '').trim();
          }
          return '';
        })
        .filter(Boolean)
    : [];

  return {
    id: data.id as string,
    name: data.name as string,
    addressLine1: (data.address_line_1 as string | null) ?? null,
    addressLine2: (data.address_line_2 as string | null) ?? null,
    town: (data.town as string | null) ?? null,
    postcode: (data.postcode as string | null) ?? null,
    latitude: (data.latitude as number | null) ?? null,
    longitude: (data.longitude as number | null) ?? null,
    sector: (data.sector as string | null) ?? null,
    tenure: (data.tenure as string | null) ?? null,
    disposalType: (data.disposal_type as DisposalType) ?? 'to_let',
    status: (data.status as ListingStatus) ?? 'draft',
    askingRentPence: (data.asking_rent_pence as number | null) ?? null,
    askingPricePence: (data.asking_price_pence as number | null) ?? null,
    rentFrequency: (data.rent_frequency as string | null) ?? null,
    hideRentFromMarketing: Boolean(data.hide_rent_from_marketing),
    sizeMinSqft: (data.size_min_sqft as number | null) ?? null,
    sizeMaxSqft: (data.size_max_sqft as number | null) ?? null,
    measurementStandard: (data.measurement_standard as string | null) ?? null,
    useClass: (data.use_class as string | null) ?? null,
    availableFrom: (data.available_from as string | null) ?? null,
    epcRating: (data.epc_rating as number | null) ?? null,
    breeamRating: (data.breeam_rating as string | null) ?? null,
    summary: (data.summary as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    keyPoints,
    referenceNumber: (data.reference_number as string | null) ?? null,
  };
}

async function loadUnitsForRightmove(
  accountId: string,
  listingId: string,
): Promise<RightmoveMapperUnit[]> {
  const { data, error } = await db()
    .from('commercial_listing_units')
    .select(
      'id, label, floor_or_unit, size_sqft, measurement_standard, sort_order, external_id',
    )
    .eq('listing_id', listingId)
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: (row.label as string) ?? '',
    floorOrUnit: (row.floor_or_unit as string | null) ?? null,
    sizeSqft: (row.size_sqft as number | null) ?? null,
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    externalId: (row.external_id as string | null) ?? null,
  }));
}

async function loadPublicMediaForRightmove(
  accountId: string,
  listingId: string,
): Promise<RightmoveMapperMedia[]> {
  const { data, error } = await db()
    .from('commercial_listing_media')
    .select(
      'media_type, mime_type, file_name, storage_path, external_url, sort_order, is_cover',
    )
    .eq('listing_id', listingId)
    .eq('account_id', accountId)
    .eq('is_private', false)
    .order('is_cover', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const client = db();
  const rows = data ?? [];

  return Promise.all(
    rows.map(async (row) => {
      const externalUrl = (row.external_url as string | null)?.trim() || null;
      const storagePath = (row.storage_path as string | null)?.trim() || null;
      let url: string | null = externalUrl;

      if (!url && storagePath) {
        const { data: signed, error: signError } = await client.storage
          .from('commercial-listing-media')
          .createSignedUrl(storagePath, RIGHTMOVE_MEDIA_URL_TTL_SECONDS);
        if (signError) {
          console.error(
            '[rightmove] media signed URL error:',
            signError.message,
          );
        } else {
          url = signed?.signedUrl ?? null;
        }
      }

      return {
        mediaType: (row.media_type as string) ?? 'image',
        mimeType: (row.mime_type as string | null) ?? null,
        fileName: (row.file_name as string | null) ?? null,
        url,
        sortOrder: (row.sort_order as number) ?? 0,
        isCover: Boolean(row.is_cover),
      };
    }),
  );
}

/** Minimal RTDF commercial field checks before a real Rightmove push. */
function validateRightmoveCommercialFields(listing: {
  name: string;
  postcode: string | null;
  disposal_type: string;
  asking_rent_pence: number | null;
  asking_price_pence: number | null;
  address_line_1: string | null;
}): string[] {
  const missing: string[] = [];
  if (!listing.name?.trim()) missing.push('name');
  if (!listing.postcode?.trim()) missing.push('postcode');
  if (!listing.address_line_1?.trim()) missing.push('address_line_1');
  if (listing.disposal_type === 'to_let' && listing.asking_rent_pence == null) {
    missing.push('asking_rent_pence');
  }
  if (
    (listing.disposal_type === 'for_sale' ||
      listing.disposal_type === 'investment') &&
    listing.asking_price_pence == null
  ) {
    missing.push('asking_price_pence');
  }
  return missing;
}

/** Minimal EACH commercial field checks. */
function validateEachCommercialFields(listing: {
  name: string;
  postcode: string | null;
  disposal_type: string;
  size_min_sqft: number | null;
}): string[] {
  const missing: string[] = [];
  if (!listing.name?.trim()) missing.push('name');
  if (!listing.postcode?.trim()) missing.push('postcode');
  if (listing.size_min_sqft == null) missing.push('size_min_sqft');
  if (!listing.disposal_type) missing.push('disposal_type');
  return missing;
}

async function recordPublication(input: {
  accountId: string;
  listingId: string;
  portal: 'rightmove' | 'each';
  status: PublicationStatus;
  lastError: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  branchRef?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('commercial_portal_publications')
    .upsert(
      {
        account_id: input.accountId,
        listing_id: input.listingId,
        portal: input.portal,
        status: input.status,
        external_id: input.externalId ?? null,
        external_url: input.externalUrl ?? null,
        branch_ref: input.branchRef ?? null,
        last_sync_at: now,
        last_error: input.lastError,
        metadata: input.metadata ?? {},
        updated_at: now,
      },
      { onConflict: 'listing_id,portal' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CommercialPortalPublication;
}

async function recordStubPublication(input: {
  accountId: string;
  listingId: string;
  portal: 'rightmove' | 'each';
  lastError: string;
  metadata?: Record<string, unknown>;
}) {
  return recordPublication({
    accountId: input.accountId,
    listingId: input.listingId,
    portal: input.portal,
    status: 'error',
    lastError: input.lastError,
    metadata: input.metadata,
  });
}

function parseAgentId(branchId: string | null | undefined): number | null {
  if (!branchId?.trim()) return null;
  const n = Number(branchId.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function resolveRightmoveAgentFromListing(input: {
  accountId: string;
  listingId: string;
}): Promise<
  | {
      ok: true;
      agentId: number;
      branchRef: string;
      accountBranchId: string;
      accountBranchName: string;
    }
  | { ok: false; error: string; stage: string }
> {
  const { data: listing, error } = await db()
    .from('commercial_listings')
    .select('account_branch_id')
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .single();

  if (error) {
    return { ok: false, error: error.message, stage: 'listing_load' };
  }

  const accountBranchId =
    (listing?.account_branch_id as string | null | undefined) ?? null;
  if (!accountBranchId) {
    return {
      ok: false,
      error:
        'Assign an Office / branch on the disposal Management tab before publishing to Rightmove',
      stage: 'missing_account_branch',
    };
  }

  const { data: branch, error: branchError } = await db()
    .from('account_branches')
    .select('id, name, rightmove_branch_id')
    .eq('id', accountBranchId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (branchError) {
    return { ok: false, error: branchError.message, stage: 'branch_load' };
  }
  if (!branch) {
    return {
      ok: false,
      error: 'Assigned workspace branch was not found',
      stage: 'branch_missing',
    };
  }

  const agentId = parseAgentId(
    (branch.rightmove_branch_id as string | null) ?? null,
  );
  if (agentId == null) {
    return {
      ok: false,
      error: `Add a Rightmove Branch ID for “${branch.name as string}” under Brand settings → Branches`,
      stage: 'missing_rightmove_branch_id',
    };
  }

  return {
    ok: true,
    agentId,
    branchRef: String(agentId),
    accountBranchId: branch.id as string,
    accountBranchName: (branch.name as string) ?? 'Branch',
  };
}

/**
 * Validate commercial fields, map listing → Rightmove payload, and PUT
 * /v2/property/commercial/{reference}. Branch ID is sent as building.agentId.
 */
export async function publishToRightmove(
  accountId: string,
  listingId: string,
): Promise<CommercialPortalPublication> {
  const listingCheck = await loadListingForPortalValidation(
    accountId,
    listingId,
  );
  const missing = validateRightmoveCommercialFields(listingCheck);

  if (missing.length > 0) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError: `Missing Rightmove commercial fields: ${missing.join(', ')}`,
      metadata: { missingFields: missing, stage: 'validation' },
    });
  }

  if (!isRightmoveOAuthConfigured()) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError:
        'RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY are not configured on the server',
      metadata: { stage: 'pending_credentials' },
    });
  }

  const resolved = await resolveRightmoveAgentFromListing({
    accountId,
    listingId,
  });
  if (!resolved.ok) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError: resolved.error,
      metadata: { stage: resolved.stage },
    });
  }

  try {
    const env = getRightmoveEnv();
    const [listing, units, media] = await Promise.all([
      loadListingForRightmove(accountId, listingId),
      loadUnitsForRightmove(accountId, listingId),
      loadPublicMediaForRightmove(accountId, listingId),
    ]);

    const mapped = mapListingToRightmovePayload({
      listing,
      agentId: resolved.agentId,
      units,
      media,
    });

    const result = await putCommercialProperty({
      reference: mapped.reference,
      payload: mapped.payload,
    });

    const note = mapped.published
      ? result.created
        ? 'Created on Rightmove (async processing may delay live visibility).'
        : 'Updated on Rightmove (async processing may delay live visibility).'
      : 'Uploaded with published=false (listing status is not Marketing / Under offer).';

    return recordPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      status: mapped.published ? 'published' : 'draft',
      lastError: null,
      externalId: mapped.reference,
      externalUrl: result.displayUrl,
      branchRef: resolved.branchRef,
      metadata: {
        stage: 'put_ok',
        environment: env.environment,
        httpStatus: result.status,
        created: result.created,
        published: mapped.published,
        traceId: result.traceId,
        spaceCount: units.length,
        mediaCount: media.filter((m) => m.url).length,
        listingName: listing.name,
        accountBranchId: resolved.accountBranchId,
        accountBranchName: resolved.accountBranchName,
        agentId: resolved.agentId,
        note,
      },
    });
  } catch (err) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError:
        err instanceof Error ? err.message : 'Rightmove publish failed',
      metadata: { stage: 'put_error' },
    });
  }
}

/**
 * Remove a previously published commercial listing from Rightmove.
 */
export async function unpublishFromRightmove(
  accountId: string,
  listingId: string,
  removalReason: RightmoveRemovalReason = 'WITHDRAWN_FROM_MARKET',
): Promise<CommercialPortalPublication> {
  if (!isRightmoveOAuthConfigured()) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError:
        'RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY are not configured on the server',
      metadata: { stage: 'pending_credentials' },
    });
  }

  const resolved = await resolveRightmoveAgentFromListing({
    accountId,
    listingId,
  });
  if (!resolved.ok) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError: resolved.error,
      metadata: { stage: resolved.stage },
    });
  }

  try {
    const env = getRightmoveEnv();
    const { data: existing } = await db()
      .from('commercial_portal_publications')
      .select('external_id')
      .eq('account_id', accountId)
      .eq('listing_id', listingId)
      .eq('portal', 'rightmove')
      .maybeSingle();

    const listing = await loadListingForRightmove(accountId, listingId);
    const reference =
      ((existing?.external_id as string | null) ?? null)?.trim() ||
      resolveRightmovePropertyReference(listing);

    await deleteCommercialProperty({
      reference,
      agentId: resolved.agentId,
      removalReason,
    });

    return recordPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      status: 'unpublished',
      lastError: null,
      externalId: reference,
      externalUrl: null,
      branchRef: resolved.branchRef,
      metadata: {
        stage: 'delete_ok',
        environment: env.environment,
        removalReason,
        accountBranchId: resolved.accountBranchId,
        accountBranchName: resolved.accountBranchName,
        agentId: resolved.agentId,
        note: 'Removed from Rightmove (async processing may delay site updates).',
      },
    });
  } catch (err) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError:
        err instanceof Error ? err.message : 'Rightmove remove failed',
      metadata: { stage: 'delete_error', removalReason },
    });
  }
}

/**
 * Scaffold: validate EACH commercial fields and record a pending/error
 * publication until EACH API credentials are wired.
 */
export async function publishToEach(
  accountId: string,
  listingId: string,
): Promise<CommercialPortalPublication> {
  const listing = await loadListingForPortalValidation(accountId, listingId);
  const missing = validateEachCommercialFields(listing);

  if (missing.length > 0) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'each',
      lastError: `Missing EACH commercial fields: ${missing.join(', ')}`,
      metadata: { missingFields: missing, stage: 'validation' },
    });
  }

  return recordStubPublication({
    accountId,
    listingId,
    portal: 'each',
    lastError: 'EACH credentials not configured',
    metadata: { stage: 'pending_credentials' },
  });
}

export async function listPublications(
  accountId: string,
  listingId?: string,
): Promise<CommercialPortalPublication[]> {
  let query = db()
    .from('commercial_portal_publications')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });

  if (listingId) {
    query = query.eq('listing_id', listingId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CommercialPortalPublication[];
}
