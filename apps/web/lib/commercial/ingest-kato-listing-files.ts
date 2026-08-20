import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type KatoFeedFileItem,
  katoFileAlreadyExists,
  parseKatoFeedFiles,
} from '~/lib/commercial/kato-feed-files';
import {
  type MigrateExternalMediaResult,
  migrateExternalListingMediaRow,
} from '~/lib/commercial/migrate-external-listing-media';

export type IngestKatoListingFilesSummary = {
  feedItems: number;
  inserted: number;
  skippedExisting: number;
  unmatchedExternalIds: string[];
  downloaded: number;
  downloadFailed: number;
  results: Array<MigrateExternalMediaResult & { fileName?: string }>;
};

function mimeGuess(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/pdf';
}

/**
 * Insert Kato brochure / EPC / floorplan URLs onto matched listings, then
 * download into Ozer storage.
 */
export async function ingestKatoListingFiles(
  client: SupabaseClient,
  input: {
    accountId: string;
    xml: string;
    concurrency?: number;
    download?: boolean;
    onProgress?: (message: string) => void;
  },
): Promise<IngestKatoListingFilesSummary> {
  const items = parseKatoFeedFiles(input.xml);
  const wanted = items.filter((item) =>
    ['brochure', 'epc', 'floorplan'].includes(item.mediaType),
  );

  const { data: listings, error: listingError } = await client
    .from('commercial_listings')
    .select('id, external_id')
    .eq('account_id', input.accountId)
    .not('external_id', 'is', null);

  if (listingError) throw new Error(listingError.message);

  const listingByExternal = new Map(
    ((listings ?? []) as Array<{ id: string; external_id: string | null }>).map(
      (row) => [row.external_id!.trim(), row.id] as const,
    ),
  );

  const listingIds = [...new Set([...listingByExternal.values()])];
  const existingByListing = new Map<
    string,
    Array<{ file_name: string | null; external_url: string | null }>
  >();

  if (listingIds.length > 0) {
    const { data: media, error: mediaError } = await client
      .from('commercial_listing_media')
      .select('listing_id, file_name, external_url, media_type')
      .eq('account_id', input.accountId)
      .in('listing_id', listingIds)
      .in('media_type', ['brochure', 'epc', 'floorplan']);

    if (mediaError) throw new Error(mediaError.message);

    for (const row of (media ?? []) as Array<{
      listing_id: string;
      file_name: string | null;
      external_url: string | null;
    }>) {
      const list = existingByListing.get(row.listing_id) ?? [];
      list.push(row);
      existingByListing.set(row.listing_id, list);
    }
  }

  const unmatched = new Set<string>();
  const toInsert: Array<KatoFeedFileItem & { listingId: string }> = [];
  let skippedExisting = 0;

  for (const item of wanted) {
    const listingId = listingByExternal.get(item.externalId);
    if (!listingId) {
      unmatched.add(item.externalId);
      continue;
    }
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        input.onProgress?.(`skip unsafe URL ${item.fileName}`);
        continue;
      }
    } catch {
      input.onProgress?.(`skip invalid URL ${item.fileName}`);
      continue;
    }
    const existing = existingByListing.get(listingId) ?? [];
    if (katoFileAlreadyExists(existing, item)) {
      skippedExisting += 1;
      continue;
    }
    toInsert.push({ ...item, listingId });
    existing.push({ file_name: item.fileName, external_url: item.url });
    existingByListing.set(listingId, existing);
  }

  let inserted = 0;
  const insertedRows: Array<{
    id: string;
    account_id: string;
    listing_id: string;
    external_url: string;
    file_name: string | null;
    mime_type: string | null;
    storage_path: string | null;
  }> = [];

  for (const item of toInsert) {
    const { data, error } = await client
      .from('commercial_listing_media')
      .insert({
        account_id: input.accountId,
        listing_id: item.listingId,
        media_type: item.mediaType,
        storage_path: null,
        external_url: item.url,
        file_name: item.fileName,
        mime_type: mimeGuess(item.fileName),
        sort_order: 0,
        is_cover: false,
        is_private: false,
      })
      .select(
        'id, account_id, listing_id, external_url, file_name, mime_type, storage_path',
      )
      .single();

    if (error || !data) {
      input.onProgress?.(
        `insert failed ${item.externalId} ${item.fileName}: ${error?.message ?? 'unknown'}`,
      );
      continue;
    }

    inserted += 1;
    insertedRows.push(data as (typeof insertedRows)[number]);
  }

  const results: IngestKatoListingFilesSummary['results'] = [];
  let downloaded = 0;
  let downloadFailed = 0;

  if (input.download !== false) {
    const concurrency = Math.max(1, Math.min(6, input.concurrency ?? 4));
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= insertedRows.length) return;
        const row = insertedRows[index]!;
        const result = await migrateExternalListingMediaRow(client, row);
        results.push({ ...result, fileName: row.file_name ?? undefined });
        if (result.status === 'migrated') downloaded += 1;
        if (result.status === 'failed') {
          downloadFailed += 1;
          input.onProgress?.(
            `download failed ${row.file_name}: ${result.error ?? 'unknown'}`,
          );
        } else {
          input.onProgress?.(`ok ${row.file_name}`);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, insertedRows.length) }, () =>
        worker(),
      ),
    );
  }

  return {
    feedItems: wanted.length,
    inserted,
    skippedExisting,
    unmatchedExternalIds: [...unmatched],
    downloaded,
    downloadFailed,
    results,
  };
}
