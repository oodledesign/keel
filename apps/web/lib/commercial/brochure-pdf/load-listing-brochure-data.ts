import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getAppSiteOrigin } from '~/lib/app-host-routing';
import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import { fetchNearbyBrochureAmenities } from '~/lib/commercial/brochure-pdf/nearby-amenities';
import type { DisposalType } from '~/lib/commercial/commercial-constants';
import { resolveCommercialMediaPublicUrl } from '~/lib/commercial/migrate-external-listing-media';
import type {
  BrochureAgent,
  BrochureBranch,
  BrochureListing,
  BrochureMediaItem,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

function mapKeyPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function signMediaUrl(
  admin: {
    storage: {
      from: (bucket: string) => {
        createSignedUrl: (
          path: string,
          expiresIn: number,
        ) => Promise<{
          data: { signedUrl?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  },
  storagePath: string | null,
  externalUrl: string | null,
): Promise<string | null> {
  let storageSignedUrl: string | null = null;
  if (storagePath) {
    const { data, error } = await admin.storage
      .from('commercial-listing-media')
      .createSignedUrl(storagePath, 3600);
    if (error) {
      console.error('[brochure-pdf] signed media url error:', error.message);
    } else {
      storageSignedUrl = data?.signedUrl ?? null;
    }
  }

  return resolveCommercialMediaPublicUrl({
    storageSignedUrl,
    externalUrl,
  });
}

function mapListingRow(listingRow: Record<string, unknown>): BrochureListing {
  return {
    id: listingRow.id as string,
    accountId: listingRow.account_id as string,
    name: (listingRow.name as string) ?? 'Property',
    addressLine1: (listingRow.address_line_1 as string | null) ?? null,
    addressLine2: (listingRow.address_line_2 as string | null) ?? null,
    town: (listingRow.town as string | null) ?? null,
    county: (listingRow.county as string | null) ?? null,
    postcode: (listingRow.postcode as string | null) ?? null,
    latitude: asNum(listingRow.latitude),
    longitude: asNum(listingRow.longitude),
    disposalType: (listingRow.disposal_type as DisposalType) ?? 'to_let',
    tenure: (listingRow.tenure as string | null) ?? null,
    useClass: (listingRow.use_class as string | null) ?? null,
    askingRentPence: asNum(listingRow.asking_rent_pence),
    askingRentToPence: asNum(listingRow.asking_rent_to_pence),
    askingPricePence: asNum(listingRow.asking_price_pence),
    rentFrequency: (listingRow.rent_frequency as string | null) ?? null,
    hideRentFromMarketing: Boolean(listingRow.hide_rent_from_marketing),
    hidePriceFromMarketing: Boolean(listingRow.hide_price_from_marketing),
    serviceChargePerSqft: asNum(listingRow.service_charge_per_sqft),
    ratesPayablePerSqft: asNum(listingRow.rates_payable_per_sqft),
    estateChargePerSqft: asNum(listingRow.estate_charge_per_sqft),
    sizeMinSqft: asNum(listingRow.size_min_sqft),
    sizeMaxSqft: asNum(listingRow.size_max_sqft),
    epcBand: (listingRow.epc_band as string | null) ?? null,
    epcRating: asNum(listingRow.epc_rating),
    availableFrom: (listingRow.available_from as string | null) ?? null,
    summary: (listingRow.summary as string | null) ?? null,
    description: (listingRow.description as string | null) ?? null,
    locationCopy: (listingRow.location_copy as string | null) ?? null,
    keyPoints: mapKeyPoints(listingRow.key_points),
  };
}

function pickStaffPhone(row: {
  phone_direct?: string | null;
  phone_mobile?: string | null;
}): string | null {
  return row.phone_direct?.trim() || row.phone_mobile?.trim() || null;
}

const LISTING_SELECT = [
  'id',
  'account_id',
  'name',
  'address_line_1',
  'address_line_2',
  'town',
  'county',
  'postcode',
  'latitude',
  'longitude',
  'disposal_type',
  'tenure',
  'use_class',
  'asking_rent_pence',
  'asking_rent_to_pence',
  'asking_price_pence',
  'rent_frequency',
  'hide_rent_from_marketing',
  'hide_price_from_marketing',
  'service_charge_per_sqft',
  'rates_payable_per_sqft',
  'estate_charge_per_sqft',
  'size_min_sqft',
  'size_max_sqft',
  'epc_band',
  'epc_rating',
  'available_from',
  'summary',
  'description',
  'location_copy',
  'key_points',
  'account_branch_id',
  'website_url',
  'brochure_share_token',
  'brochure_share_enabled',
].join(', ');

/**
 * Authenticated brochure payload for PDF / editor (workspace RLS).
 */
export async function loadListingBrochureData(
  listingId: string,
  accountId: string,
): Promise<PublicBrochureData | null> {
  const client = getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseServerAdminClient() as any;

  const { data: row, error } = await client
    .from('commercial_listings')
    .select(LISTING_SELECT)
    .eq('id', listingId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[brochure-pdf] load listing error:', error.message);
    return null;
  }
  if (!row) return null;

  const listing = mapListingRow(row as unknown as Record<string, unknown>);
  const listingBranchId =
    ((row as unknown as Record<string, unknown>).account_branch_id as
      | string
      | null
      | undefined) ?? null;

  const [
    { data: accountRow },
    { data: agentRows },
    { data: mediaRows },
    { data: branchRows },
    nearbyAmenities,
  ] = await Promise.all([
    client
      .from('accounts')
      .select('name')
      .eq('id', listing.accountId)
      .maybeSingle(),
    client
      .from('commercial_listing_agents')
      .select('user_id, sort_order')
      .eq('listing_id', listing.id)
      .eq('account_id', listing.accountId)
      .order('sort_order', { ascending: true }),
    client
      .from('commercial_listing_media')
      .select(
        'id, media_type, storage_path, external_url, file_name, mime_type, sort_order, is_cover, is_private',
      )
      .eq('listing_id', listing.id)
      .eq('is_private', false)
      .in('media_type', ['image', 'floorplan'])
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    client
      .from('account_branches')
      .select(
        'id, name, address, phone, email, is_default, sort_order, shopfront_url',
      )
      .eq('account_id', listing.accountId)
      .order('sort_order', { ascending: true }),
    listing.latitude != null && listing.longitude != null
      ? fetchNearbyBrochureAmenities({
          latitude: listing.latitude,
          longitude: listing.longitude,
          town: listing.town,
        })
      : Promise.resolve([]),
  ]);

  const userIds = (
    (agentRows ?? []) as Array<{ user_id: string; sort_order: number }>
  ).map((r) => r.user_id);

  const accountByUser = new Map<
    string,
    { name: string | null; email: string | null; pictureUrl: string | null }
  >();

  if (userIds.length > 0) {
    const { data: memberAccounts } = await admin
      .from('accounts')
      .select('id, name, email, picture_url')
      .in('id', userIds);

    for (const acc of (memberAccounts ?? []) as Array<{
      id: string;
      name: string | null;
      email: string | null;
      picture_url: string | null;
    }>) {
      accountByUser.set(acc.id, {
        name: acc.name,
        email: acc.email,
        pictureUrl: acc.picture_url,
      });
    }
  }

  const agents: BrochureAgent[] = (
    (agentRows ?? []) as Array<{ user_id: string; sort_order: number }>
  ).map((agentRow) => {
    const member = accountByUser.get(agentRow.user_id);
    return {
      userId: agentRow.user_id,
      name: member?.name?.trim() || member?.email?.trim() || 'Agent',
      email: member?.email?.trim() || null,
      phone: null,
      pictureUrl: member?.pictureUrl?.trim() || null,
    };
  });

  const agentEmails = agents
    .map((agent) => agent.email?.toLowerCase())
    .filter((email): email is string => Boolean(email));

  if (agentEmails.length > 0) {
    try {
      const signatures = supabaseCustomSchema(admin, 'signatures');
      const { data: staffRows } = await signatures
        .from('staff')
        .select('email, signature_email, phone_direct, phone_mobile')
        .eq('account_id', listing.accountId);

      const phoneByEmail = new Map<string, string>();
      for (const staff of (staffRows ?? []) as Array<{
        email?: string | null;
        signature_email?: string | null;
        phone_direct?: string | null;
        phone_mobile?: string | null;
      }>) {
        const phone = pickStaffPhone(staff);
        if (!phone) continue;
        for (const key of [staff.email, staff.signature_email]) {
          const normalized = key?.trim().toLowerCase();
          if (normalized) phoneByEmail.set(normalized, phone);
        }
      }

      for (const agent of agents) {
        const email = agent.email?.toLowerCase();
        if (email && phoneByEmail.has(email)) {
          agent.phone = phoneByEmail.get(email) ?? null;
        }
      }
    } catch (err) {
      console.error(
        '[brochure-pdf] staff phone load error:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const signedMedia = await Promise.all(
    (
      (mediaRows ?? []) as Array<{
        id: string;
        media_type: string;
        storage_path: string | null;
        external_url: string | null;
        file_name: string | null;
        mime_type: string | null;
        is_cover: boolean | null;
      }>
    ).map(async (item) => {
      const url = await signMediaUrl(
        admin,
        item.storage_path,
        item.external_url,
      );
      if (!url) return null;

      const mediaType = item.media_type === 'floorplan' ? 'floorplan' : 'image';
      if (
        mediaType === 'floorplan' &&
        item.mime_type?.toLowerCase().includes('pdf')
      ) {
        return null;
      }

      return {
        id: item.id,
        mediaType: mediaType as 'image' | 'floorplan',
        url,
        fileName: item.file_name,
        isCover: Boolean(item.is_cover),
      } satisfies BrochureMediaItem;
    }),
  );

  const media = signedMedia.filter(
    (item): item is BrochureMediaItem => item != null,
  );

  let brand: PublicBrochureData['brand'] = {
    logoUrl: null,
    primaryColor: DEFAULT_BRAND_PRIMARY,
    secondaryColor: DEFAULT_BRAND_SECONDARY,
    accentColor: DEFAULT_BRAND_ACCENT,
  };
  let brandContact: Pick<BrochureBranch, 'address' | 'phone' | 'email'> = {
    address: null,
    phone: null,
    email: null,
  };

  try {
    const resolved = await loadAccountBrandResolved(listing.accountId);
    brand = {
      logoUrl: resolved.logo_url,
      primaryColor: resolved.primary_color,
      secondaryColor: resolved.secondary_color,
      accentColor: resolved.accent_color,
    };
    brandContact = {
      address: resolved.address,
      phone: resolved.phone,
      email: resolved.contact_email,
    };
  } catch (err) {
    console.error(
      '[brochure-pdf] brand load error:',
      err instanceof Error ? err.message : err,
    );
  }

  const branches = (branchRows ?? []) as Array<{
    id: string;
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    is_default: boolean | null;
    shopfront_url?: string | null;
  }>;
  const listingBranch = listingBranchId
    ? branches.find((item) => item.id === listingBranchId)
    : null;
  const defaultBranch =
    branches.find((item) => item.is_default) ?? branches[0] ?? null;
  const pickedBranch = listingBranch ?? defaultBranch;
  const accountName =
    (accountRow?.name as string | null | undefined)?.trim() || null;

  const branch: BrochureBranch = {
    name: pickedBranch?.name?.trim() || accountName,
    address: pickedBranch?.address?.trim() || brandContact.address,
    phone: pickedBranch?.phone?.trim() || brandContact.phone,
    email: pickedBranch?.email?.trim() || brandContact.email,
    shopfrontUrl: pickedBranch?.shopfront_url?.trim() || null,
  };

  const listingRow = row as unknown as Record<string, unknown>;
  const websiteListingUrl =
    (listingRow.website_url as string | null | undefined)?.trim() || null;
  const brochureToken =
    (listingRow.brochure_share_token as string | null | undefined)?.trim() ||
    null;
  const brochureEnabled = Boolean(listingRow.brochure_share_enabled);
  let slideshowBrochureUrl: string | null = null;
  if (brochureEnabled && brochureToken) {
    try {
      slideshowBrochureUrl = new URL(
        `/share/brochure/${brochureToken}`,
        getAppSiteOrigin(),
      ).toString();
    } catch {
      slideshowBrochureUrl = `/share/brochure/${brochureToken}`;
    }
  }

  return {
    token: '',
    listing,
    accountName,
    brand,
    agents,
    images: media.filter((m) => m.mediaType === 'image'),
    floorplans: media.filter((m) => m.mediaType === 'floorplan'),
    branch,
    nearbyAmenities,
    websiteListingUrl,
    slideshowBrochureUrl,
  };
}
