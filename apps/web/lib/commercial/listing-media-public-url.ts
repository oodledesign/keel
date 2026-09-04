/**
 * Short, stable public URLs for commercial listing media.
 * Rightmove Commercial API rejects media URLs longer than 250 chars and
 * requires brochure URLs to end with a `.pdf` extension — Supabase signed
 * URLs fail both constraints.
 */
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import {
  extensionFromMime,
  extensionFromUrlOrName,
} from '~/lib/commercial/migrate-external-listing-media';

export const RIGHTMOVE_MEDIA_URL_MAX_LENGTH = 250;

export function commercialListingMediaFileName(input: {
  mediaType: string;
  fileName?: string | null;
  mimeType?: string | null;
}): string {
  const fromName = extensionFromUrlOrName(input.fileName);
  const fromMime = extensionFromMime(input.mimeType);
  let ext = fromName ?? (fromMime !== 'bin' ? fromMime : null);

  if (input.mediaType === 'brochure') {
    ext = 'pdf';
  } else if (input.mediaType === 'epc' && !ext) {
    ext = 'pdf';
  } else if (!ext) {
    ext = input.mediaType === 'video' ? 'mp4' : 'jpg';
  }

  const stem =
    input.mediaType === 'brochure'
      ? 'brochure'
      : input.mediaType === 'floorplan'
        ? 'floorplan'
        : input.mediaType === 'epc'
          ? 'epc'
          : 'file';

  return `${stem}.${ext}`;
}

export function buildCommercialListingMediaPublicPath(input: {
  mediaId: string;
  mediaType: string;
  fileName?: string | null;
  mimeType?: string | null;
}): string {
  const file = commercialListingMediaFileName(input);
  return `/api/commercial/listing-media/${input.mediaId}/${file}`;
}

export function buildCommercialListingMediaPublicUrl(input: {
  siteUrl: string;
  mediaId: string;
  mediaType: string;
  fileName?: string | null;
  mimeType?: string | null;
}): string {
  const base = input.siteUrl.replace(/\/+$/, '');
  return `${base}${buildCommercialListingMediaPublicPath(input)}`;
}

/**
 * Rightmove caches media by source URL. If a first fetch 404s, later PUTs with
 * the same URL may never re-download.
 *
 * Important: brochure URLs must *literally* end with `.pdf` (query strings
 * fail validation). Use a hyphenated stem (`brochure-v123.pdf`) — dotted stems
 * like `brochure.v123.pdf` are rejected by Rightmove's extension check.
 */
export function withRightmoveMediaCacheBust(
  url: string,
  version: string | number,
): string {
  const bust = String(version)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!bust) return url;
  try {
    const parsed = new URL(url);
    // Signed / CDN URLs need their query string (auth tokens). Busting would
    // strip it — skip those and only rewrite clean pathname URLs.
    if (parsed.search || parsed.hash) return url;
    const path = parsed.pathname;
    const lastSlash = path.lastIndexOf('/');
    const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    const file = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    const dot = file.lastIndexOf('.');
    if (dot <= 0) {
      parsed.pathname = `${dir}${file}-v${bust}`;
    } else {
      parsed.pathname = `${dir}${file.slice(0, dot)}-v${bust}${file.slice(dot)}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveSiteUrlForPublicMedia(): string | null {
  // Prefer the authenticated app host — marketing www does not serve these routes.
  const candidates = [
    getAppSiteOrigin(),
    process.env.NEXT_PUBLIC_APP_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(
        value.startsWith('http') ? value : `https://${value}`,
      );
      return url.origin;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Supabase signed URLs often leave spaces (and other reserved chars) unescaped
 * in the path when the storage object key contains them. Browsers and some
 * HTTP clients then fail to load the asset. Re-encode the pathname safely.
 */
export function encodeStorageSignedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split('/')
      .map((segment) => {
        if (!segment) return segment;
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Gallery / lightbox preview transform — keeps admin UI snappy for large JPEGs. */
export const LISTING_MEDIA_PREVIEW_TRANSFORM = {
  width: 1600,
  height: 1600,
  resize: 'contain' as const,
  quality: 75,
};

export function listingMediaSupportsPreviewTransform(
  mimeType: string | null | undefined,
): boolean {
  const value = (mimeType ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  return (
    value === 'image/jpeg' ||
    value === 'image/jpg' ||
    value === 'image/png' ||
    value === 'image/webp'
  );
}
