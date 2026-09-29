import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LISTING_MEDIA_DERIVATIVES,
  type ListingMediaDerivativeKind,
  listingMediaDerivativePath,
  listingMediaSupportsDerivatives,
} from '~/lib/commercial/listing-media-public-url';

const BUCKET = 'commercial-listing-media';
const KINDS: ListingMediaDerivativeKind[] = ['thumb', 'preview'];

export type ListingMediaDerivativeRow = {
  id: string;
  account_id: string;
  storage_path: string | null;
  mime_type: string | null;
};

export type EnsureDerivativesResult = {
  id: string;
  status: 'created' | 'skipped' | 'failed';
  error?: string;
};

export async function renderListingImageDerivatives(
  bytes: Buffer,
): Promise<Record<ListingMediaDerivativeKind, Buffer>> {
  const sharp = (await import('sharp')).default;
  const render = (kind: ListingMediaDerivativeKind) => {
    const spec = LISTING_MEDIA_DERIVATIVES[kind];
    return sharp(bytes)
      .rotate()
      .resize({
        width: spec.maxLongEdge,
        height: spec.maxLongEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: Math.round(spec.quality * 100), mozjpeg: true })
      .toBuffer();
  };

  return { thumb: await render('thumb'), preview: await render('preview') };
}

/** Render and upload both copies; returns their paths for the media row. */
export async function storeListingImageDerivatives(
  client: SupabaseClient,
  storagePath: string,
  bytes: Buffer,
): Promise<{ thumbPath: string; previewPath: string }> {
  const rendered = await renderListingImageDerivatives(bytes);
  const bucket = client.storage.from(BUCKET);

  for (const kind of KINDS) {
    const { error } = await bucket.upload(
      listingMediaDerivativePath(storagePath, kind),
      rendered[kind],
      { contentType: 'image/jpeg', upsert: true },
    );
    if (error) throw new Error(`${kind} upload: ${error.message}`);
  }

  return {
    thumbPath: listingMediaDerivativePath(storagePath, 'thumb'),
    previewPath: listingMediaDerivativePath(storagePath, 'preview'),
  };
}

/** Backfill one existing photo from its stored original. */
export async function ensureListingMediaDerivatives(
  client: SupabaseClient,
  row: ListingMediaDerivativeRow,
): Promise<EnsureDerivativesResult> {
  const storagePath = row.storage_path?.trim();
  if (!storagePath || !listingMediaSupportsDerivatives(row.mime_type)) {
    return { id: row.id, status: 'skipped' };
  }

  try {
    const { data, error } = await client.storage
      .from(BUCKET)
      .download(storagePath);
    if (error || !data) {
      throw new Error(error?.message ?? 'Original download failed');
    }

    const paths = await storeListingImageDerivatives(
      client,
      storagePath,
      Buffer.from(await data.arrayBuffer()),
    );

    const { error: updateError } = await client
      .from('commercial_listing_media')
      .update({ thumb_path: paths.thumbPath, preview_path: paths.previewPath })
      .eq('id', row.id)
      .eq('account_id', row.account_id)
      .eq('storage_path', storagePath);
    if (updateError) throw new Error(updateError.message);

    return { id: row.id, status: 'created' };
  } catch (error) {
    return {
      id: row.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listListingMediaMissingDerivatives(
  client: SupabaseClient,
  input: { accountId?: string; limit: number; afterId?: string },
): Promise<ListingMediaDerivativeRow[]> {
  let query = client
    .from('commercial_listing_media')
    .select('id, account_id, storage_path, mime_type')
    .not('storage_path', 'is', null)
    .or('thumb_path.is.null,preview_path.is.null')
    .in('mime_type', ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
    .order('id', { ascending: true })
    .limit(input.limit);

  if (input.accountId) query = query.eq('account_id', input.accountId);
  if (input.afterId) query = query.gt('id', input.afterId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ListingMediaDerivativeRow[];
}
