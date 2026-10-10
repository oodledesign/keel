import 'server-only';

import {
  supabaseStorageObjectPath,
  toSupabasePublicStorageUrl,
} from '~/lib/storage/public-url';

function isSafeRemoteImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '169.254.169.254' ||
      host.startsWith('169.254.') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isWorkspaceSupabaseHost(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

const BROCHURE_STORAGE_BUCKETS = [
  'commercial-listing-media',
  'brand-assets',
] as const;

async function downloadStorageObjectBytes(
  url: string,
): Promise<Uint8Array | null> {
  if (!isWorkspaceSupabaseHost(url)) return null;

  try {
    // Dynamic import so the admin client is only loaded when HTTP fetch fails.
    const { getSupabaseServerAdminClient } =
      await import('@kit/supabase/server-admin-client');
    const admin = getSupabaseServerAdminClient();

    for (const bucket of BROCHURE_STORAGE_BUCKETS) {
      const path = supabaseStorageObjectPath(url, bucket);
      if (!path) continue;
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error || !data) continue;
      return new Uint8Array(await data.arrayBuffer());
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchBrochureImageBytes(
  url: string | null,
): Promise<Uint8Array | null> {
  if (!url) return null;
  // Signed listing-media URLs must not be rewritten to /object/public/sign/...
  const normalized = toSupabasePublicStorageUrl(url) ?? url;
  if (!isSafeRemoteImageUrl(normalized)) {
    const fromStorage = await downloadStorageObjectBytes(normalized);
    if (fromStorage) return fromStorage;
    console.error('[brochure-pdf] blocked unsafe image url host');
    return null;
  }
  try {
    const res = await fetch(normalized, {
      cache: 'no-store',
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/*,*/*' },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (
        contentType &&
        !contentType.startsWith('image/') &&
        !contentType.includes('octet-stream')
      ) {
        console.error(
          '[brochure-pdf] blocked non-image content-type:',
          contentType,
        );
      } else {
        return new Uint8Array(await res.arrayBuffer());
      }
    } else {
      console.error('[brochure-pdf] image fetch failed:', res.status);
    }
  } catch {
    // Fall through to workspace storage download.
  }

  return downloadStorageObjectBytes(normalized);
}
