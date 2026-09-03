import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isBlockedLogoHostname } from '~/lib/clients/client-logo-icons';

import {
  type DisposalType,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from './commercial-constants';
import {
  decryptCommercialSecret,
  encryptCommercialSecret,
} from './commercial-crypto';
import { OZER_LISTING_ID_META_KEY } from './property-hive-custom-fields';

export type PropertyHiveCredentials = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  officeId?: string | null;
};

export type CommercialListingRow = {
  id: string;
  account_id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  country: string | null;
  sector: string | null;
  tenure: string | null;
  disposal_type: DisposalType;
  status: string;
  asking_rent_pence: number | null;
  asking_rent_to_pence?: number | null;
  asking_price_pence: number | null;
  rent_frequency: string | null;
  hide_rent_from_marketing: boolean;
  hide_price_from_marketing?: boolean;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  measurement_standard: string | null;
  use_class: string | null;
  available_from: string | null;
  epc_band: string | null;
  epc_rating: number | null;
  summary: string | null;
  description: string | null;
  location_copy: string | null;
  key_points: unknown;
};

export type PropertyHivePayload = {
  title: string;
  status: 'publish' | 'draft';
  on_market: 'yes' | 'no';
  /** PH department: commercial_to_rent | commercial_for_sale (custom dept names) */
  department: 'commercial_to_rent' | 'commercial_for_sale';
  address_street?: string;
  address_two?: string;
  address_three?: string;
  address_postcode?: string;
  address_country?: string;
  for_sale?: 'yes' | 'no';
  to_rent?: 'yes' | 'no';
  floor_area_from?: number;
  floor_area_to?: number;
  floor_area_units?: string;
  rent?: number;
  rent_from?: number;
  rent_to?: number;
  rent_frequency?: string;
  price?: number;
  price_from?: number;
  price_to?: number;
  available_date?: string;
  description?: string;
  features?: string[];
  office_id?: string;
  commercial_tenure?: string;
  /** Ozer listing UUID for WP/Property Hive custom-field mapping. */
  ozer_listing_id?: string;
};

type PublicationStatus = 'draft' | 'published' | 'unpublished' | 'error';

/** Untyped until `pnpm supabase:web:typegen` includes commercial_* tables. */
function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
}

function adminDb(): SupabaseClient {
  return getSupabaseServerAdminClient() as unknown as SupabaseClient;
}

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

/** HTTPS-only public host — blocks localhost / private / metadata SSRF targets. */
function assertSafePropertyHiveSiteUrl(siteUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    throw new Error('Invalid Property Hive site URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Property Hive site URL must use https://');
  }

  if (isBlockedLogoHostname(parsed.hostname)) {
    throw new Error('Property Hive site URL host is not allowed');
  }

  return normalizeSiteUrl(parsed.origin);
}

function penceToPounds(pence: number | null | undefined): number | undefined {
  if (pence == null) return undefined;
  return Math.round(pence) / 100;
}

function keyPointsToFeatures(keyPoints: unknown): string[] | undefined {
  if (!Array.isArray(keyPoints)) return undefined;
  const features = keyPoints
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text: unknown }).text ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
  return features.length > 0 ? features : undefined;
}

export function mapListingToPropertyHivePayload(
  listing: CommercialListingRow,
  options?: { officeId?: string | null; onMarket?: boolean },
): PropertyHivePayload {
  const includesToLet = disposalIncludesToLet(listing.disposal_type);
  const includesForSale = disposalIncludesForSale(listing.disposal_type);
  const onMarket =
    options?.onMarket ??
    (listing.status === 'marketing' || listing.status === 'under_offer');

  const rentPounds = penceToPounds(listing.asking_rent_pence);
  const rentToPounds =
    penceToPounds(listing.asking_rent_to_pence ?? null) ?? rentPounds;
  const pricePounds = penceToPounds(listing.asking_price_pence);

  const payload: PropertyHivePayload = {
    title: listing.name,
    status: onMarket ? 'publish' : 'draft',
    on_market: onMarket ? 'yes' : 'no',
    department: includesToLet ? 'commercial_to_rent' : 'commercial_for_sale',
    for_sale: includesForSale ? 'yes' : 'no',
    to_rent: includesToLet ? 'yes' : 'no',
    address_street: listing.address_line_1 ?? undefined,
    address_two: listing.address_line_2 ?? undefined,
    address_three: listing.town ?? undefined,
    address_postcode: listing.postcode ?? undefined,
    address_country: listing.country ?? 'GB',
    floor_area_units: 'sqft',
    description:
      [listing.summary, listing.description, listing.location_copy]
        .filter(Boolean)
        .join('\n\n') || undefined,
    features: keyPointsToFeatures(listing.key_points),
    available_date: listing.available_from ?? undefined,
    commercial_tenure: listing.tenure ?? undefined,
    [OZER_LISTING_ID_META_KEY]: listing.id,
  };

  if (listing.size_min_sqft != null) {
    payload.floor_area_from = Number(listing.size_min_sqft);
  }
  if (listing.size_max_sqft != null) {
    payload.floor_area_to = Number(listing.size_max_sqft);
  } else if (listing.size_min_sqft != null) {
    payload.floor_area_to = Number(listing.size_min_sqft);
  }

  if (
    includesToLet &&
    rentPounds != null &&
    !listing.hide_rent_from_marketing
  ) {
    payload.rent = rentPounds;
    payload.rent_from = rentPounds;
    payload.rent_to = rentToPounds ?? rentPounds;
    payload.rent_frequency = listing.rent_frequency ?? 'per_annum';
  }

  if (
    includesForSale &&
    pricePounds != null &&
    !listing.hide_price_from_marketing
  ) {
    payload.price = pricePounds;
    payload.price_from = pricePounds;
    payload.price_to = pricePounds;
  }

  if (options?.officeId) {
    payload.office_id = options.officeId;
  }

  return payload;
}

export async function getPropertyHiveCredentials(
  accountId: string,
): Promise<PropertyHiveCredentials | null> {
  const { data, error } = await db()
    .from('commercial_portal_credentials')
    .select('site_url, username, secret_ciphertext, office_id')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.site_url || !data?.username || !data?.secret_ciphertext) {
    return null;
  }

  return {
    siteUrl: data.site_url as string,
    username: data.username as string,
    applicationPassword: decryptCommercialSecret(
      data.secret_ciphertext as string,
    ),
    officeId: (data.office_id as string | null) ?? null,
  };
}

export async function savePropertyHiveCredentials(
  accountId: string,
  credentials: PropertyHiveCredentials,
): Promise<void> {
  const siteUrl = assertSafePropertyHiveSiteUrl(credentials.siteUrl.trim());
  const ciphertext = encryptCommercialSecret(
    credentials.applicationPassword.trim(),
  );

  const { error } = await db()
    .from('commercial_portal_credentials')
    .upsert(
      {
        account_id: accountId,
        portal: 'property_hive',
        site_url: siteUrl,
        username: credentials.username.trim(),
        secret_ciphertext: ciphertext,
        office_id: credentials.officeId?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,portal' },
    );

  if (error) throw new Error(error.message);
}

async function loadListing(
  accountId: string,
  listingId: string,
): Promise<CommercialListingRow> {
  const { data, error } = await db()
    .from('commercial_listings')
    .select('*')
    .eq('id', listingId)
    .eq('account_id', accountId)
    .single();

  if (error) throw new Error(error.message);
  return data as CommercialListingRow;
}

async function getExistingPublication(accountId: string, listingId: string) {
  const { data } = await db()
    .from('commercial_portal_publications')
    .select('id, external_id, external_url, status')
    .eq('account_id', accountId)
    .eq('listing_id', listingId)
    .eq('portal', 'property_hive')
    .maybeSingle();

  return data as {
    id: string;
    external_id: string | null;
    external_url: string | null;
    status: string;
  } | null;
}

async function upsertPublication(input: {
  accountId: string;
  listingId: string;
  externalId?: string | null;
  externalUrl?: string | null;
  status: PublicationStatus;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const { error } = await db()
    .from('commercial_portal_publications')
    .upsert(
      {
        account_id: input.accountId,
        listing_id: input.listingId,
        portal: 'property_hive',
        external_id: input.externalId ?? null,
        external_url: input.externalUrl ?? null,
        status: input.status,
        last_sync_at: now,
        last_error: input.lastError ?? null,
        metadata: input.metadata ?? {},
        updated_at: now,
      },
      { onConflict: 'listing_id,portal' },
    );

  if (error) throw new Error(error.message);
}

/**
 * Persist a Property Hive failure so the Publishing channels card can show it.
 * Callers must already have authorised the listing write. Admin is used only
 * here so a session RLS miss cannot wipe external_id or hide the error.
 */
export async function persistPropertyHivePublicationError(input: {
  accountId: string;
  listingId: string;
  lastError: string;
}): Promise<void> {
  const writer = adminDb();
  const { data: existing } = await writer
    .from('commercial_portal_publications')
    .select('external_id, external_url')
    .eq('account_id', input.accountId)
    .eq('listing_id', input.listingId)
    .eq('portal', 'property_hive')
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = await writer.from('commercial_portal_publications').upsert(
    {
      account_id: input.accountId,
      listing_id: input.listingId,
      portal: 'property_hive',
      external_id:
        (existing as { external_id?: string | null } | null)?.external_id ??
        null,
      external_url:
        (existing as { external_url?: string | null } | null)?.external_url ??
        null,
      status: 'error' as const,
      last_sync_at: now,
      last_error: input.lastError,
      updated_at: now,
    },
    { onConflict: 'listing_id,portal' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

function basicAuthHeader(username: string, applicationPassword: string) {
  const token = Buffer.from(
    `${username}:${applicationPassword}`,
    'utf8',
  ).toString('base64');
  return `Basic ${token}`;
}

async function callPropertyHiveApi(params: {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  method: 'POST' | 'PUT';
  externalId?: string | null;
  body: PropertyHivePayload;
}): Promise<{ id: number; link?: string }> {
  const base = assertSafePropertyHiveSiteUrl(params.siteUrl);
  if (
    params.method === 'PUT' &&
    params.externalId &&
    !/^\d+$/.test(params.externalId)
  ) {
    throw new Error('Invalid Property Hive external id');
  }

  const url =
    params.method === 'PUT' && params.externalId
      ? `${base}/wp-json/wp/v2/property/${params.externalId}`
      : `${base}/wp-json/wp/v2/property`;

  const response = await fetch(url, {
    method: params.method,
    headers: {
      Authorization: basicAuthHeader(
        params.username,
        params.applicationPassword,
      ),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params.body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let json: { id?: number; link?: string; message?: string } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) {
    throw new Error(
      json.message || `Property Hive API request failed (${response.status})`,
    );
  }

  if (!json.id) {
    throw new Error('Property Hive API returned no post id');
  }

  return { id: json.id, link: json.link };
}

/**
 * Push a commercial listing to WordPress Property Hive (create or update).
 * Upserts commercial_portal_publications with portal=property_hive.
 */
export async function pushListingToPropertyHive(
  accountId: string,
  listingId: string,
): Promise<{ externalId: string; externalUrl?: string }> {
  const credentials = await getPropertyHiveCredentials(accountId);
  if (!credentials) {
    await upsertPublication({
      accountId,
      listingId,
      status: 'error',
      lastError: 'Property Hive credentials not configured',
    });
    throw new Error('Property Hive credentials not configured');
  }

  try {
    const listing = await loadListing(accountId, listingId);
    const existing = await getExistingPublication(accountId, listingId);
    const payload = mapListingToPropertyHivePayload(listing, {
      officeId: credentials.officeId,
      onMarket: true,
    });

    const result = await callPropertyHiveApi({
      siteUrl: credentials.siteUrl,
      username: credentials.username,
      applicationPassword: credentials.applicationPassword,
      method: existing?.external_id ? 'PUT' : 'POST',
      externalId: existing?.external_id,
      body: payload,
    });

    const externalId = String(result.id);
    const externalUrl =
      result.link ?? `${normalizeSiteUrl(credentials.siteUrl)}/?p=${result.id}`;

    await upsertPublication({
      accountId,
      listingId,
      externalId,
      externalUrl,
      status: 'published',
      lastError: null,
      metadata: { department: payload.department },
    });

    return { externalId, externalUrl };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Property Hive sync failed';
    await upsertPublication({
      accountId,
      listingId,
      status: 'error',
      lastError: message,
    });
    throw err instanceof Error ? err : new Error(message);
  }
}

/**
 * Take a listing off market in Property Hive (on_market=no / draft)
 * when withdrawn, let, or sold.
 */
export async function unpublishListingFromPropertyHive(
  accountId: string,
  listingId: string,
): Promise<void> {
  const credentials = await getPropertyHiveCredentials(accountId);
  const existing = await getExistingPublication(accountId, listingId);

  if (!credentials || !existing?.external_id) {
    await upsertPublication({
      accountId,
      listingId,
      externalId: existing?.external_id,
      status: 'unpublished',
      lastError: credentials
        ? null
        : 'Property Hive credentials not configured; marked unpublished locally',
    });
    return;
  }

  try {
    const listing = await loadListing(accountId, listingId);
    const payload = mapListingToPropertyHivePayload(listing, {
      officeId: credentials.officeId,
      onMarket: false,
    });
    payload.status = 'draft';
    payload.on_market = 'no';

    await callPropertyHiveApi({
      siteUrl: credentials.siteUrl,
      username: credentials.username,
      applicationPassword: credentials.applicationPassword,
      method: 'PUT',
      externalId: existing.external_id,
      body: payload,
    });

    await upsertPublication({
      accountId,
      listingId,
      externalId: existing.external_id,
      status: 'unpublished',
      lastError: null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Property Hive unpublish failed';
    await upsertPublication({
      accountId,
      listingId,
      externalId: existing.external_id,
      status: 'error',
      lastError: message,
    });
    throw err instanceof Error ? err : new Error(message);
  }
}
