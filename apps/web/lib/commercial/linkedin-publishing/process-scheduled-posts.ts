import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  markLinkedInConnectionNeedsReconnect,
  parseImageMediaIds,
  resolveLinkedInAccessToken,
} from '~/lib/commercial/linkedin-publishing/connections';
import { LinkedInApiError } from '~/lib/commercial/linkedin-publishing/linkedin-api';
import { publishListingToLinkedInOrg } from '~/lib/commercial/linkedin-publishing/publish-post';

type DuePostRow = {
  id: string;
  account_id: string;
  listing_id: string;
  body: string;
  image_media_ids: unknown;
  overlay_first: boolean;
};

type ListingRow = {
  id: string;
  status: string;
  disposal_type: string;
  town: string | null;
  asking_rent_pence: number | null;
  asking_rent_to_pence: number | null;
  asking_price_pence: number | null;
  rent_frequency: string | null;
  hide_rent_from_marketing: boolean | null;
  hide_price_from_marketing: boolean | null;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
};

type MediaRow = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
};

export async function processDueLinkedInPosts(admin: SupabaseClient): Promise<{
  posted: number;
  failed: number;
  scanned: number;
}> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('listing_linkedin_posts')
    .select('id, account_id, listing_id, body, image_media_ids, overlay_first')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DuePostRow[];
  let posted = 0;
  let failed = 0;

  for (const row of rows) {
    const claimed = await admin
      .from('listing_linkedin_posts')
      .update({ status: 'posting', error: null })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (!claimed.data) continue;

    try {
      const tokens = await resolveLinkedInAccessToken(admin, row.account_id);
      const { data: listing } = await admin
        .from('commercial_listings')
        .select(
          'id, status, disposal_type, town, asking_rent_pence, asking_rent_to_pence, asking_price_pence, rent_frequency, hide_rent_from_marketing, hide_price_from_marketing, size_min_sqft, size_max_sqft',
        )
        .eq('id', row.listing_id)
        .maybeSingle();

      if (!listing) {
        throw new Error('Listing not found');
      }

      const listingRow = listing as ListingRow;
      const ids = parseImageMediaIds(row.image_media_ids);
      const { data: mediaRows } = ids.length
        ? await admin
            .from('commercial_listing_media')
            .select('id, storage_path, external_url, file_name, mime_type')
            .eq('listing_id', row.listing_id)
            .in('id', ids)
        : { data: [] };

      const mediaById = new Map(
        ((mediaRows ?? []) as MediaRow[]).map((item) => [item.id, item]),
      );
      const images = ids
        .map((id) => mediaById.get(id))
        .filter((item): item is MediaRow => Boolean(item))
        .map((item) => ({
          id: item.id,
          storagePath: item.storage_path,
          externalUrl: item.external_url,
          fileName: item.file_name,
          mimeType: item.mime_type,
        }));

      const urn = await publishListingToLinkedInOrg({
        client: admin,
        accessToken: tokens.accessToken,
        organizationUrn: tokens.orgUrn,
        commentary: row.body,
        images,
        overlayFirst: row.overlay_first,
        overlayListing: {
          status: listingRow.status,
          disposalType: listingRow.disposal_type as
            | 'to_let'
            | 'for_sale'
            | 'investment'
            | 'to_let_and_for_sale',
          town: listingRow.town,
          askingRentPence: listingRow.asking_rent_pence,
          askingRentToPence: listingRow.asking_rent_to_pence,
          askingPricePence: listingRow.asking_price_pence,
          rentFrequency: listingRow.rent_frequency,
          hideRentFromMarketing: Boolean(listingRow.hide_rent_from_marketing),
          hidePriceFromMarketing: Boolean(listingRow.hide_price_from_marketing),
          sizeMinSqft: listingRow.size_min_sqft,
          sizeMaxSqft: listingRow.size_max_sqft,
        },
      });

      await admin
        .from('listing_linkedin_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          linkedin_post_urn: urn,
          error: null,
        })
        .eq('id', row.id);
      posted += 1;
    } catch (error) {
      if (error instanceof LinkedInApiError && error.reconnect) {
        await markLinkedInConnectionNeedsReconnect(admin, row.account_id);
      }
      await admin
        .from('listing_linkedin_posts')
        .update({
          status: 'failed',
          error:
            error instanceof Error ? error.message : 'LinkedIn post failed',
        })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return { posted, failed, scanned: rows.length };
}
