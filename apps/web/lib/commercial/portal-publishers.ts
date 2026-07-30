import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

async function recordStubPublication(input: {
  accountId: string;
  listingId: string;
  portal: 'rightmove' | 'each';
  lastError: string;
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
        status: 'error',
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

/**
 * Scaffold: validate RTDF commercial fields and record a pending/error
 * publication until Rightmove credentials + feed are wired.
 */
export async function publishToRightmove(
  accountId: string,
  listingId: string,
): Promise<CommercialPortalPublication> {
  const listing = await loadListingForPortalValidation(accountId, listingId);
  const missing = validateRightmoveCommercialFields(listing);

  if (missing.length > 0) {
    return recordStubPublication({
      accountId,
      listingId,
      portal: 'rightmove',
      lastError: `Missing RTDF commercial fields: ${missing.join(', ')}`,
      metadata: { missingFields: missing, stage: 'validation' },
    });
  }

  return recordStubPublication({
    accountId,
    listingId,
    portal: 'rightmove',
    lastError: 'RTDF credentials not configured',
    metadata: { stage: 'pending_credentials' },
  });
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
