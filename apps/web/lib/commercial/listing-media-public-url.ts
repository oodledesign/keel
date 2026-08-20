/**
 * Short, stable public URLs for commercial listing media.
 * Rightmove Commercial API rejects media URLs longer than 250 chars and
 * requires brochure URLs to end with a `.pdf` extension — Supabase signed
 * URLs fail both constraints.
 */
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

export function resolveSiteUrlForPublicMedia(): string | null {
  const candidates = [
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
