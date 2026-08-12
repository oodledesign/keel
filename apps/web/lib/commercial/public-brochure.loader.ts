import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import type { DisposalType } from '~/lib/commercial/commercial-constants';
import { resolveCommercialMediaPublicUrl } from '~/lib/commercial/migrate-external-listing-media';
import type {
  BrochureAgent,
  BrochureListing,
  BrochureMediaItem,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

export type {
  BrochureAgent,
  BrochureListing,
  BrochureMediaItem,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

export {
  extractBrochureShareToken,
  formatBrochureAddress,
  formatBrochureMoney,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
  formatDisposalLabel,
} from '~/lib/commercial/public-brochure.shared';

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
      console.error('[brochure] signed media url error:', error.message);
    } else {
      storageSignedUrl = data?.signedUrl ?? null;
    }
  }

  return resolveCommercialMediaPublicUrl({
    storageSignedUrl,
    externalUrl,
  });
}

async function loadPublicBrochureByTokenUncached(
  token: string,
): Promise<PublicBrochureData | null> {
  if (!token || token.length < 16) {
    return null;
  }

  // Token-gated public page — admin client (matches /share/listing).
  // Cast via any: generated types lag brochure_share_* migration columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseServerAdminClient() as any;

  const { data: row, error } = await admin
    .from('commercial_listings')
    .select(
      [
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
        'size_min_sqft',
        'size_max_sqft',
        'epc_band',
        'epc_rating',
        'available_from',
        'summary',
        'description',
        'location_copy',
        'key_points',
      ].join(', '),
    )
    .eq('brochure_share_token', token)
    .eq('brochure_share_enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[brochure] load listing error:', error.message);
    return null;
  }
  if (!row) return null;

  const listingRow = row as Record<string, unknown>;

  const listing: BrochureListing = {
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

  const [{ data: accountRow }, { data: agentRows }, { data: mediaRows }] =
    await Promise.all([
      admin
        .from('accounts')
        .select('name')
        .eq('id', listing.accountId)
        .maybeSingle(),
      admin
        .from('commercial_listing_agents')
        .select('user_id, sort_order')
        .eq('listing_id', listing.id)
        .eq('account_id', listing.accountId)
        .order('sort_order', { ascending: true }),
      admin
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
  ).map((row) => {
    const member = accountByUser.get(row.user_id);
    return {
      userId: row.user_id,
      name: member?.name?.trim() || member?.email?.trim() || 'Agent',
      email: member?.email?.trim() || null,
      phone: null,
      pictureUrl: member?.pictureUrl?.trim() || null,
    };
  });

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

      // Floorplan PDFs aren't useful as slideshow slides
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

  try {
    const resolved = await loadAccountBrandResolved(listing.accountId);
    brand = {
      logoUrl: resolved.logo_url,
      primaryColor: resolved.primary_color,
      secondaryColor: resolved.secondary_color,
      accentColor: resolved.accent_color,
    };
  } catch (err) {
    console.error(
      '[brochure] brand load error:',
      err instanceof Error ? err.message : err,
    );
  }

  return {
    token,
    listing,
    accountName:
      (accountRow?.name as string | null | undefined)?.trim() || null,
    brand,
    agents,
    images: media.filter((m) => m.mediaType === 'image'),
    floorplans: media.filter((m) => m.mediaType === 'floorplan'),
  };
}

/** Dedupes metadata + page loads in the same request. */
export const loadPublicBrochureByToken = cache(
  loadPublicBrochureByTokenUncached,
);
