import type { SupabaseClient } from '@supabase/supabase-js';

import { randomUUID } from 'node:crypto';

export const COMMERCIAL_LISTING_MEDIA_BUCKET = 'commercial-listing-media';
export const EXTERNAL_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
export const EXTERNAL_MEDIA_FETCH_TIMEOUT_MS = 30_000;

export type ExternalListingMediaRow = {
  id: string;
  account_id: string;
  listing_id: string;
  external_url: string;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string | null;
};

export type MigrateExternalMediaResult = {
  id: string;
  status: 'migrated' | 'skipped' | 'failed';
  storagePath?: string;
  error?: string;
};

export type MigrateExternalMediaBatchSummary = {
  processed: number;
  migrated: number;
  skipped: number;
  failed: number;
  remaining: number;
  results: MigrateExternalMediaResult[];
};

export function safeMediaFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

export function extensionFromMime(mime: string | null | undefined): string {
  const value = (mime ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  switch (value) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export function extensionFromUrlOrName(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const clean = value.split('?')[0]?.split('#')[0] ?? '';
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (!match?.[1]) return null;
  const ext = match[1].toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return null;
}

export function mimeFromExtension(ext: string | null): string | null {
  switch (ext) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    default:
      return null;
  }
}

export function buildStoragePath(input: {
  accountId: string;
  listingId: string;
  fileName: string;
  uuid?: string;
}): string {
  return `${input.accountId}/${input.listingId}/${input.uuid ?? randomUUID()}-${safeMediaFileName(input.fileName)}`;
}

/**
 * Prefer Ozer storage (signed URL) over legacy external hosts (e.g. AS imgix).
 */
export function resolveCommercialMediaPublicUrl(input: {
  storageSignedUrl: string | null | undefined;
  externalUrl: string | null | undefined;
}): string | null {
  const stored = input.storageSignedUrl?.trim() || null;
  if (stored) return stored;
  const external = input.externalUrl?.trim() || null;
  return external || null;
}

async function readBodyWithCap(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Remote file exceeds ${maxBytes} bytes`);
  }

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Remote file exceeds ${maxBytes} bytes`);
    }
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error(`Remote file exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function downloadExternalMedia(url: string): Promise<{
  bytes: Buffer;
  contentType: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    EXTERNAL_MEDIA_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,application/pdf,*/*',
        'User-Agent': 'OzerMediaIngest/1.0 (+https://ozer.so)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching media`);
    }

    const bytes = await readBodyWithCap(response, EXTERNAL_MEDIA_MAX_BYTES);
    if (bytes.byteLength < 32) {
      throw new Error('Downloaded file too small');
    }

    return {
      bytes,
      contentType: response.headers.get('content-type'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveFileName(
  row: ExternalListingMediaRow,
  mime: string | null,
): string {
  const existing = row.file_name?.trim();
  if (existing) return existing;

  const fromUrl = extensionFromUrlOrName(row.external_url);
  const fromMime = extensionFromMime(mime);
  const ext = fromUrl ?? fromMime;
  return `media-${row.id.slice(0, 8)}.${ext}`;
}

/**
 * Download one external media row into `commercial-listing-media` and clear
 * `external_url` so feeds cannot keep using Agents Society / imgix hosts.
 */
export async function migrateExternalListingMediaRow(
  client: SupabaseClient,
  row: ExternalListingMediaRow,
): Promise<MigrateExternalMediaResult> {
  if (row.storage_path?.trim()) {
    return { id: row.id, status: 'skipped', storagePath: row.storage_path };
  }

  const externalUrl = row.external_url?.trim();
  if (!externalUrl) {
    return { id: row.id, status: 'skipped', error: 'No external_url' };
  }

  try {
    const downloaded = await downloadExternalMedia(externalUrl);
    const headerMime =
      downloaded.contentType?.split(';')[0]?.trim().toLowerCase() || null;
    const mime =
      headerMime && headerMime !== 'application/octet-stream'
        ? headerMime
        : row.mime_type ||
          mimeFromExtension(extensionFromUrlOrName(row.file_name)) ||
          mimeFromExtension(extensionFromUrlOrName(externalUrl)) ||
          'image/jpeg';

    const fileName = resolveFileName(row, mime);
    const storagePath = buildStoragePath({
      accountId: row.account_id,
      listingId: row.listing_id,
      fileName,
    });

    const { error: uploadError } = await client.storage
      .from(COMMERCIAL_LISTING_MEDIA_BUCKET)
      .upload(storagePath, downloaded.bytes, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: updateError } = await client
      .from('commercial_listing_media')
      .update({
        storage_path: storagePath,
        external_url: null,
        mime_type: row.mime_type || mime,
        file_name: row.file_name || fileName,
      })
      .eq('id', row.id)
      .eq('account_id', row.account_id)
      .is('storage_path', null);

    if (updateError) {
      // Best-effort cleanup of orphaned upload
      await client.storage
        .from(COMMERCIAL_LISTING_MEDIA_BUCKET)
        .remove([storagePath]);
      throw new Error(updateError.message);
    }

    return { id: row.id, status: 'migrated', storagePath };
  } catch (error) {
    return {
      id: row.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown ingest error',
    };
  }
}

export async function listExternalOnlyListingMedia(
  client: SupabaseClient,
  input?: {
    accountId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ExternalListingMediaRow[]> {
  let query = client
    .from('commercial_listing_media')
    .select(
      'id, account_id, listing_id, external_url, file_name, mime_type, storage_path',
    )
    .not('external_url', 'is', null)
    .is('storage_path', null)
    .order('created_at', { ascending: true });

  if (input?.accountId) {
    query = query.eq('account_id', input.accountId);
  }
  if (input?.limit != null) {
    const from = input.offset ?? 0;
    query = query.range(from, from + input.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as ExternalListingMediaRow[]).filter(
    (row) => Boolean(row.external_url?.trim()) && !row.storage_path?.trim(),
  );
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Migrate a batch of external-only listing media into Ozer storage.
 */
export async function migrateExternalListingMediaBatch(
  client: SupabaseClient,
  options?: {
    accountId?: string;
    limit?: number;
    concurrency?: number;
    onProgress?: (result: MigrateExternalMediaResult, index: number) => void;
  },
): Promise<MigrateExternalMediaBatchSummary> {
  const limit = options?.limit ?? 50;
  const concurrency = options?.concurrency ?? 5;

  const rows = await listExternalOnlyListingMedia(client, {
    accountId: options?.accountId,
    limit,
  });

  const results = await mapPool(rows, concurrency, async (row) => {
    const result = await migrateExternalListingMediaRow(client, row);
    return result;
  });

  results.forEach((result, index) => options?.onProgress?.(result, index));

  const { count, error: countError } = await client
    .from('commercial_listing_media')
    .select('id', { count: 'exact', head: true })
    .not('external_url', 'is', null)
    .is('storage_path', null);

  if (countError) throw new Error(countError.message);

  return {
    processed: results.length,
    migrated: results.filter((r) => r.status === 'migrated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    remaining: count ?? 0,
    results,
  };
}
