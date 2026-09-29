import type { SupabaseClient } from '@supabase/supabase-js';

import { createListingImageDerivatives } from '~/lib/commercial/compress-listing-image';
import {
  type ListingMediaDerivativeKind,
  listingMediaDerivativePath,
} from '~/lib/commercial/listing-media-public-url';

export type ListingImageDerivativePaths = {
  thumbPath: string | null;
  previewPath: string | null;
};

const NO_DERIVATIVES: ListingImageDerivativePaths = {
  thumbPath: null,
  previewPath: null,
};

/**
 * Upload thumb + preview copies next to `storagePath`. Never throws: a failed
 * copy only means the app shows the original until the backfill script runs.
 */
export async function uploadListingImageDerivatives(
  client: SupabaseClient,
  storagePath: string,
  file: File,
): Promise<ListingImageDerivativePaths> {
  const derivatives = await createListingImageDerivatives(file);
  if (!derivatives) return NO_DERIVATIVES;

  const bucket = client.storage.from('commercial-listing-media');
  const kinds: ListingMediaDerivativeKind[] = ['thumb', 'preview'];
  const uploaded: string[] = [];

  try {
    for (const kind of kinds) {
      const path = listingMediaDerivativePath(storagePath, kind);
      const { error } = await bucket.upload(path, derivatives[kind], {
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      uploaded.push(path);
    }
  } catch (error) {
    console.warn(
      '[listing-media] derivative upload failed:',
      error instanceof Error ? error.message : error,
    );
    if (uploaded.length > 0) {
      await bucket.remove(uploaded).catch(() => undefined);
    }
    return NO_DERIVATIVES;
  }

  return {
    thumbPath: listingMediaDerivativePath(storagePath, 'thumb'),
    previewPath: listingMediaDerivativePath(storagePath, 'preview'),
  };
}
