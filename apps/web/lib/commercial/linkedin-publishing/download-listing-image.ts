import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { COMMERCIAL_LISTING_MEDIA_BUCKET } from '~/lib/commercial/migrate-external-listing-media';

export type ListingImageSource = {
  id: string;
  storagePath: string | null;
  externalUrl: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function downloadListingImageBytes(
  client: SupabaseClient,
  item: ListingImageSource,
): Promise<{ bytes: Buffer; contentType: string }> {
  if (item.storagePath) {
    const { data, error } = await client.storage
      .from(COMMERCIAL_LISTING_MEDIA_BUCKET)
      .download(item.storagePath);
    if (!error && data) {
      const bytes = Buffer.from(await data.arrayBuffer());
      return {
        bytes,
        contentType: item.mimeType?.startsWith('image/')
          ? item.mimeType
          : 'image/jpeg',
      };
    }
  }

  const remote = item.url?.trim() || item.externalUrl?.trim();
  if (!remote) {
    throw new Error(`Listing photo ${item.id} has no downloadable URL`);
  }

  const res = await fetch(remote);
  if (!res.ok) {
    throw new Error(`Could not download listing photo (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get('content-type')?.split(';')[0] ||
    item.mimeType ||
    'image/jpeg';
  return { bytes, contentType };
}
