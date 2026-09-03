import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createRequire } from 'node:module';

import type {
  DisposalType,
  ListingLetType,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';
import { recordListingEvent } from '~/lib/commercial/listing-events';
import {
  RIGHTMOVE_MEDIA_URL_MAX_LENGTH,
  buildCommercialListingMediaPublicUrl,
  resolveSiteUrlForPublicMedia,
  withRightmoveMediaCacheBust,
} from '~/lib/commercial/listing-media-public-url';
import { resolveCommercialMediaPublicUrl } from '~/lib/commercial/migrate-external-listing-media';
import {
  RightmoveApiError,
  deleteCommercialProperty,
  putCommercialProperty,
} from '~/lib/commercial/rightmove-api';
import {
  getRightmoveEnv,
  isRightmoveOAuthConfigured,
} from '~/lib/commercial/rightmove-env';
import {
  type RightmoveMapperListing,
  type RightmoveMapperMedia,
  type RightmoveMapperUnit,
  asOptionalNumber,
  deriveAskingRentPenceFromUnits,
  mapListingToRightmovePayload,
  resolveRightmovePropertyReference,
} from '~/lib/commercial/rightmove-mapper';
import type { RightmoveRemovalReason } from '~/lib/commercial/rightmove-types';

const require = createRequire(import.meta.url);

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

/** Optional override for ops scripts (e.g. bulk Rightmove publish). */
let portalPublishersClientOverride: SupabaseClient | null = null;

/**
 * Use a service-role (or other) client instead of the request-scoped server
 * client. Pass `null` to clear. Intended for one-off scripts only.
 */
export function setPortalPublishersClient(client: SupabaseClient | null): void {
  portalPublishersClientOverride = client;
}

/** Untyped until `pnpm supabase:web:typegen` includes commercial_* tables. */
function db(): SupabaseClient {
  if (portalPublishersClientOverride) {
    return portalPublishersClientOverride;
  }

  // Lazy-load so ops scripts can inject a service-role client without pulling
  // Next.js request cookies / headers at module import time.
  const { getSupabaseServerClient } =
    require('@kit/supabase/server-client') as typeof import('@kit/supabase/server-client');

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
      hide_rent_from_marketing, hide_price_from_marketing, size_min_sqft, size_max_sqft,
      measurement_standard, use_class, available_from, epc_rating,
      breeam_rating, summary, description, key_points, reference_number,
      service_charge_per_sqft, rates_payable_per_sqft, condition_description,
      fitted_space, parking_available, parking_spaces,
      let_type, let_contract_length_months
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
    latitude: asOptionalNumber(data.latitude),
    longitude: asOptionalNumber(data.longitude),
    sector: (data.sector as string | null) ?? null,
    tenure: (data.tenure as string | null) ?? null,
    disposalType: (data.disposal_type as DisposalType) ?? 'to_let',
    status: (data.status as ListingStatus) ?? 'draft',
    askingRentPence: asOptionalNumber(data.asking_rent_pence),
    askingPricePence: asOptionalNumber(data.asking_price_pence),
    rentFrequency: (data.rent_frequency as string | null) ?? null,
    hideRentFromMarketing: Boolean(data.hide_rent_from_marketing),
    hidePriceFromMarketing: Boolean(data.hide_price_from_marketing),
    sizeMinSqft: asOptionalNumber(data.size_min_sqft),
    sizeMaxSqft: asOptionalNumber(data.size_max_sqft),
    measurementStandard: (data.measurement_standard as string | null) ?? null,
    useClass: (data.use_class as string | null) ?? null,
    availableFrom: (data.available_from as string | null) ?? null,
    letType: (data.let_type as ListingLetType | null) ?? null,
    letContractLengthMonths: asOptionalNumber(data.let_contract_length_months),
    epcRating: asOptionalNumber(data.epc_rating),
    breeamRating: (data.breeam_rating as string | null) ?? null,
    summary: (data.summary as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    keyPoints,
    referenceNumber: (data.reference_number as string | null) ?? null,
    serviceChargePerSqft: asOptionalNumber(data.service_charge_per_sqft),
    ratesPayablePerSqft: asOptionalNumber(data.rates_payable_per_sqft),
    conditionDescription: (data.condition_description as string | null) ?? null,
    fittedSpace: data.fitted_space == null ? null : Boolean(data.fitted_space),
    parkingAvailable: Boolean(data.parking_available),
    parkingSpaces: asOptionalNumber(data.parking_spaces),
  };
}

async function loadUnitsForRightmove(
  accountId: string,
  listingId: string,
): Promise<RightmoveMapperUnit[]> {
  const { data, error } = await db()
    .from('commercial_listing_units')
    .select(
      `id, label, floor_or_unit, size_sqft, measurement_standard, sort_order, external_id,
       asking_rent_pence, rent_per_sqft, description, sector, status,
       service_charge_per_sqft, rates_payable_per_sqft, fitted_space`,
    )
    .eq('listing_id', listingId)
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: (row.label as string) ?? '',
    floorOrUnit: (row.floor_or_unit as string | null) ?? null,
    sizeSqft: asOptionalNumber(row.size_sqft),
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    sortOrder: asOptionalNumber(row.sort_order) ?? 0,
    externalId: (row.external_id as string | null) ?? null,
    askingRentPence: asOptionalNumber(row.asking_rent_pence),
    rentPerSqft: asOptionalNumber(row.rent_per_sqft),
    description: (row.description as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    serviceChargePerSqft: asOptionalNumber(row.service_charge_per_sqft),
    ratesPayablePerSqft: asOptionalNumber(row.rates_payable_per_sqft),
    fittedSpace: row.fitted_space == null ? null : Boolean(row.fitted_space),
  }));
}

async function loadPublicMediaForRightmove(
  accountId: string,
  listingId: string,
): Promise<RightmoveMapperMedia[]> {
  const { data, error } = await db()
    .from('commercial_listing_media')
    .select(
      'id, media_type, mime_type, file_name, storage_path, external_url, sort_order, is_cover',
    )
    .eq('listing_id', listingId)
    .eq('account_id', accountId)
    .eq('is_private', false)
    .order('is_cover', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const siteUrl = resolveSiteUrlForPublicMedia();
  const client = db();
  const rows = data ?? [];
  // Bust Rightmove's media URL cache on every publish attempt.
  const cacheBust = Math.floor(Date.now() / 1000);

  // Prefer short public proxy URLs (≤250 chars, brochure ends with .pdf).
  // Fall back to signed / external URLs only when they already fit Rightmove's limit.
  const needsSigned: string[] = [];
  if (!siteUrl) {
    for (const row of rows) {
      const storagePath = (row.storage_path as string | null)?.trim() || null;
      if (storagePath) needsSigned.push(storagePath);
    }
  }

  const signedByPath = new Map<string, string>();
  const uniquePaths = [...new Set(needsSigned)];
  const CHUNK = 100;
  for (let i = 0; i < uniquePaths.length; i += CHUNK) {
    const chunk = uniquePaths.slice(i, i + CHUNK);
    const { data: signedRows, error: signError } = await client.storage
      .from('commercial-listing-media')
      .createSignedUrls(chunk, RIGHTMOVE_MEDIA_URL_TTL_SECONDS);

    if (signError) {
      console.error('[rightmove] media signed URL error:', signError.message);
      continue;
    }

    for (let j = 0; j < chunk.length; j++) {
      const requestedPath = chunk[j]!;
      const row = signedRows?.[j];
      const signedUrl = row?.signedUrl;
      if (!signedUrl || row?.error) continue;
      signedByPath.set(requestedPath, signedUrl);
      if (row.path) signedByPath.set(row.path, signedUrl);
    }
  }

  return rows.map((row) => {
    const mediaId = (row.id as string | null)?.trim() || null;
    const mediaType = (row.media_type as string) ?? 'image';
    const mimeType = (row.mime_type as string | null) ?? null;
    const fileName = (row.file_name as string | null) ?? null;
    const externalUrl = (row.external_url as string | null)?.trim() || null;
    const storagePath = (row.storage_path as string | null)?.trim() || null;

    let url: string | null = null;
    if (siteUrl && mediaId) {
      const proxyUrl = withRightmoveMediaCacheBust(
        buildCommercialListingMediaPublicUrl({
          siteUrl,
          mediaId,
          mediaType,
          fileName,
          mimeType,
        }),
        cacheBust,
      );
      if (proxyUrl.length <= RIGHTMOVE_MEDIA_URL_MAX_LENGTH) {
        url = proxyUrl;
      }
    }

    if (!url) {
      const storageSignedUrl = storagePath
        ? (signedByPath.get(storagePath) ?? null)
        : null;
      const resolved = resolveCommercialMediaPublicUrl({
        storageSignedUrl,
        externalUrl,
      });
      if (
        resolved &&
        resolved.length <= RIGHTMOVE_MEDIA_URL_MAX_LENGTH &&
        /^https?:\/\//i.test(resolved)
      ) {
        // Only cache-bust clean URLs — signed URLs carry auth tokens in the
        // query string which withRightmoveMediaCacheBust would strip.
        const candidate = resolved.includes('?')
          ? resolved
          : withRightmoveMediaCacheBust(resolved, cacheBust);
        if (candidate.length <= RIGHTMOVE_MEDIA_URL_MAX_LENGTH) {
          url = candidate;
        }
      }
    }

    return {
      mediaType,
      mimeType,
      fileName,
      url,
      sortOrder: (row.sort_order as number) ?? 0,
      isCover: Boolean(row.is_cover),
    };
  });
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
  // Rent / price may be absent — mapper emits PRICE_ON_APPLICATION (POA).
  // Unit-level rents are applied before this check when available.
  void listing.disposal_type;
  void listing.asking_rent_pence;
  void listing.asking_price_pence;
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
  portal: 'rightmove' | 'each' | 'property_hive';
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
  const publication = data as CommercialPortalPublication;

  try {
    await recordListingEvent(db(), {
      accountId: input.accountId,
      listingId: input.listingId,
      eventType: 'portal_sync',
      summary:
        input.status === 'error'
          ? `Portal ${input.portal} failed${input.lastError ? `: ${input.lastError}` : ''}`
          : `Portal ${input.portal}: ${input.status}`,
      metadata: {
        portal: input.portal,
        status: input.status,
        lastError: input.lastError,
        publicationId: publication.id,
      },
    });
  } catch {
    /* best-effort */
  }

  return publication;
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
        'Rightmove ADF credentials not configured (RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY missing on this server)',
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

  let mediaSampleUrls: Array<string | null> | undefined;
  try {
    const env = getRightmoveEnv();
    const [listing, units, media] = await Promise.all([
      loadListingForRightmove(accountId, listingId),
      loadUnitsForRightmove(accountId, listingId),
      loadPublicMediaForRightmove(accountId, listingId),
    ]);

    let derivedRentFromUnits = false;
    if (listing.askingRentPence == null) {
      const derived = deriveAskingRentPenceFromUnits(units);
      if (derived != null) {
        listing.askingRentPence = derived;
        derivedRentFromUnits = true;
        // Persist so the workspace stays in sync with what we published.
        await db()
          .from('commercial_listings')
          .update({
            asking_rent_pence: derived,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId)
          .eq('account_id', accountId);
      }
    }

    mediaSampleUrls = media
      .filter((m) => m.url)
      .slice(0, 4)
      .map((m) => m.url);

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
        mediaSampleUrls,
        listingName: listing.name,
        accountBranchId: resolved.accountBranchId,
        accountBranchName: resolved.accountBranchName,
        agentId: resolved.agentId,
        derivedRentFromUnits,
        note,
      },
    });
  } catch (err) {
    const env = (() => {
      try {
        return getRightmoveEnv();
      } catch {
        return null;
      }
    })();

    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError:
        err instanceof Error ? err.message : 'Rightmove publish failed',
      metadata: {
        stage: 'put_error',
        environment: env?.environment ?? null,
        agentId: resolved.agentId,
        branchRef: resolved.branchRef,
        accountBranchId: resolved.accountBranchId,
        ...(mediaSampleUrls ? { mediaSampleUrls } : {}),
        ...(err instanceof RightmoveApiError
          ? {
              httpStatus: err.status,
              rawResponse: err.rawBody.slice(0, 4000),
            }
          : {}),
      },
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
        'Rightmove ADF credentials not configured (RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY missing on this server)',
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
      lastError: err instanceof Error ? err.message : 'Rightmove remove failed',
      metadata: {
        stage: 'delete_error',
        removalReason,
        ...(err instanceof RightmoveApiError
          ? {
              httpStatus: err.status,
              rawResponse: err.rawBody.slice(0, 4000),
            }
          : {}),
      },
    });
  }
}

/**
 * Website (Property Hive XML) is opt-out of the dedicated XML feed.
 * Off → unpublished (excluded from feed). On → published (included when on-market).
 * Preserves existing Property Hive external ids so a toggle cannot drop a live post.
 */
export async function setWebsiteListingFeedInclusion(input: {
  accountId: string;
  listingId: string;
  enabled: boolean;
}): Promise<CommercialPortalPublication> {
  const { accountId, listingId, enabled } = input;

  const listing = await loadListingForPortalValidation(accountId, listingId);

  const { data: existing, error: existingError } = await db()
    .from('commercial_portal_publications')
    .select('external_id, external_url, branch_ref, metadata')
    .eq('account_id', accountId)
    .eq('listing_id', listingId)
    .eq('portal', 'property_hive')
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const existingRow = existing as {
    external_id: string | null;
    external_url: string | null;
    branch_ref: string | null;
    metadata: Record<string, unknown> | null;
  } | null;

  const {
    buildPropertyHiveFeedUrl,
    ensurePropertyHiveFeedToken,
    getPropertyHiveFeedToken,
  } = await import('~/lib/commercial/property-hive-feed');

  const onMarket =
    listing.status === 'marketing' || listing.status === 'under_offer';

  if (!enabled) {
    const existingToken = await getPropertyHiveFeedToken(accountId);
    return recordPublication({
      accountId,
      listingId,
      portal: 'property_hive',
      status: 'unpublished',
      lastError: null,
      externalId: existingRow?.external_id ?? null,
      externalUrl:
        existingRow?.external_url ??
        (existingToken ? buildPropertyHiveFeedUrl(existingToken) : null),
      branchRef: existingRow?.branch_ref ?? null,
      metadata: {
        ...(existingRow?.metadata ?? {}),
        stage: 'feed_opt_out',
        portalFeed: 'property_hive',
        note: 'Excluded from website XML feed',
      },
    });
  }

  const { feedUrl } = await ensurePropertyHiveFeedToken(accountId);

  return recordPublication({
    accountId,
    listingId,
    portal: 'property_hive',
    status: onMarket ? 'published' : 'draft',
    lastError: onMarket
      ? null
      : `Listing is ${listing.status} — set Marketing or Under offer for website feed pickup`,
    externalId: existingRow?.external_id ?? null,
    externalUrl: existingRow?.external_url ?? feedUrl,
    branchRef: existingRow?.branch_ref ?? null,
    metadata: {
      ...(existingRow?.metadata ?? {}),
      stage: 'xml_feed',
      portalFeed: 'property_hive',
      note: onMarket
        ? 'Included on the website XML feed'
        : 'Website inclusion on; listing not yet on-market for export',
    },
  });
}

/**
 * EACH is opt-out of the dedicated XML feed.
 * Off → unpublished (excluded from feed). On → published (included when on-market).
 */
export async function setEachListingFeedInclusion(input: {
  accountId: string;
  listingId: string;
  enabled: boolean;
}): Promise<CommercialPortalPublication> {
  const { accountId, listingId, enabled } = input;

  const listing = await loadListingForPortalValidation(accountId, listingId);

  const { buildEachFeedUrl, ensureEachFeedToken, getEachFeedToken } =
    await import('~/lib/commercial/property-hive-feed');

  if (!enabled) {
    const existingToken = await getEachFeedToken(accountId);
    return recordPublication({
      accountId,
      listingId,
      portal: 'each',
      status: 'unpublished',
      lastError: null,
      externalUrl: existingToken ? buildEachFeedUrl(existingToken) : null,
      metadata: {
        stage: 'feed_opt_out',
        portalFeed: 'each',
        note: 'Excluded from EACH XML feed',
      },
    });
  }

  const { feedUrl } = await ensureEachFeedToken(accountId);
  const missing = validateEachCommercialFields(listing);
  const onMarket =
    listing.status === 'marketing' || listing.status === 'under_offer';

  return recordPublication({
    accountId,
    listingId,
    portal: 'each',
    status: onMarket ? 'published' : 'draft',
    lastError: missing.length
      ? `Missing EACH commercial fields: ${missing.join(', ')}`
      : onMarket
        ? null
        : `Listing is ${listing.status} — set Marketing or Under offer for EACH feed pickup`,
    externalUrl: feedUrl,
    metadata: {
      stage: 'xml_feed',
      portalFeed: 'each',
      ...(missing.length ? { missingFields: missing } : {}),
      note: onMarket
        ? 'Included on the EACH XML feed'
        : 'EACH inclusion on; listing not yet on-market for export',
    },
  });
}

/**
 * EACH pulls its dedicated Kato-compatible XML feed.
 * Records a feed-linked publication after basic field checks (explicit include).
 */
export async function publishToEach(
  accountId: string,
  listingId: string,
): Promise<CommercialPortalPublication> {
  return setEachListingFeedInclusion({
    accountId,
    listingId,
    enabled: true,
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
