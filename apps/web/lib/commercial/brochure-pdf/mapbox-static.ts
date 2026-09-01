import 'server-only';

/**
 * Mapbox Static Images API helper for brochure map pages.
 *
 * Prefer a server token without URL restrictions for PDF generation.
 * Browser-restricted NEXT_PUBLIC_MAPBOX_TOKEN often works for the disposals
 * map (client) but returns 401/403 when fetched from the server.
 */

export type BrochureMapAmenity = {
  label: string;
  index: number;
  longitude?: number;
  latitude?: number;
};

export type FetchBrochureMapImageInput = {
  longitude: number;
  latitude: number;
  /** Pixel width (CSS px before @2x). */
  width: number;
  /** Pixel height. */
  height: number;
  zoom?: number;
  amenities?: BrochureMapAmenity[];
  /** Workspace brand pin (`#RRGGBB` or `RRGGBB`). Overlay is `pin-l+RRGGBB`. */
  pinColor?: string;
};

const MAP_STYLES = ['mapbox/streets-v12', 'mapbox/light-v11'] as const;
const PIN_HEX_FALLBACK = 'FF5C34';

/** Mapbox Static overlay pin colour: 6 hex digits, no `#`. */
export function toMapboxPinHex(
  hex: string | null | undefined,
  fallback = PIN_HEX_FALLBACK,
): string {
  const cleaned = (hex ?? '').replace('#', '').trim().toUpperCase();
  if (/^[0-9A-F]{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return cleaned
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('');
  }
  return fallback;
}

type TokenSource =
  | 'MAPBOX_SECRET_TOKEN'
  | 'MAPBOX_ACCESS_TOKEN'
  | 'MAPBOX_TOKEN'
  | 'NEXT_PUBLIC_MAPBOX_TOKEN';

function resolveMapboxToken(): { token: string; source: TokenSource } | null {
  const candidates: Array<{ source: TokenSource; value: string | undefined }> =
    [
      // Server tokens first — typically no URL restrictions
      { source: 'MAPBOX_SECRET_TOKEN', value: process.env.MAPBOX_SECRET_TOKEN },
      { source: 'MAPBOX_ACCESS_TOKEN', value: process.env.MAPBOX_ACCESS_TOKEN },
      { source: 'MAPBOX_TOKEN', value: process.env.MAPBOX_TOKEN },
      {
        source: 'NEXT_PUBLIC_MAPBOX_TOKEN',
        value: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      },
    ];

  for (const candidate of candidates) {
    const token = candidate.value?.trim();
    if (token) return { token, source: candidate.source };
  }
  return null;
}

function clampSize(n: number): number {
  return Math.min(1280, Math.max(200, Math.round(n)));
}

/**
 * Build Static Images API URLs. Returns several variants so callers can retry
 * if a restricted token or overlay format fails.
 */
export function buildBrochureMapStaticUrls(
  input: FetchBrochureMapImageInput,
  token: string,
): string[] {
  const width = clampSize(input.width);
  const height = clampSize(input.height);
  const zoom = input.zoom ?? 14;
  const { longitude: lng, latitude: lat } = input;
  const tokenQs = `access_token=${encodeURIComponent(token)}`;
  const pinHex = toMapboxPinHex(input.pinColor);
  const pin = `pin-l+${pinHex}(${lng},${lat})`;

  const urls: string[] = [];
  for (const style of MAP_STYLES) {
    const base = `https://api.mapbox.com/styles/v1/${style}/static`;
    urls.push(
      `${base}/${pin}/${lng},${lat},${zoom},0/${width}x${height}@2x?${tokenQs}`,
    );
    urls.push(
      `${base}/${pin}/${lng},${lat},${zoom},0/${width}x${height}?${tokenQs}`,
    );
  }

  // Bare streets map if every overlay 422s
  const streetsBase = `https://api.mapbox.com/styles/v1/${MAP_STYLES[0]}/static`;
  urls.push(
    `${streetsBase}/${lng},${lat},${zoom},0/${width}x${height}@2x?${tokenQs}`,
  );

  return urls;
}

/** @deprecated Prefer buildBrochureMapStaticUrls — kept for callers/tests. */
export function buildBrochureMapStaticUrl(
  input: FetchBrochureMapImageInput,
): string | null {
  const resolved = resolveMapboxToken();
  if (!resolved) return null;
  return buildBrochureMapStaticUrls(input, resolved.token)[0] ?? null;
}

async function fetchMapBytes(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string } | { error: string }> {
  try {
    const res = await fetch(url, {
      // Avoid Next data-cache retaining a failed Mapbox response
      cache: 'no-store',
      headers: { Accept: 'image/png,image/jpeg,image/*' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        error: `${res.status} ${body.slice(0, 240)}`,
      };
    }
    const contentType = res.headers.get('content-type') ?? '';
    const isImage =
      contentType.startsWith('image/') ||
      contentType.includes('octet-stream') ||
      contentType === '';
    if (!isImage) {
      return { error: `non-image content-type: ${contentType}` };
    }
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

/**
 * Fetch map image bytes for embedding in the PDF.
 */
export async function fetchBrochureMapImageBytes(
  input: FetchBrochureMapImageInput,
): Promise<Uint8Array | null> {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    console.warn('[brochure-pdf] map skipped: invalid coordinates');
    return null;
  }

  const resolved = resolveMapboxToken();
  if (!resolved) {
    console.warn(
      '[brochure-pdf] Map unavailable: set MAPBOX_SECRET_TOKEN (preferred) or NEXT_PUBLIC_MAPBOX_TOKEN',
    );
    return null;
  }

  const urls = buildBrochureMapStaticUrls(input, resolved.token);
  const errors: string[] = [];

  for (const url of urls) {
    const result = await fetchMapBytes(url);
    if ('bytes' in result) {
      if (result.bytes.length < 500) {
        errors.push('image too small');
        continue;
      }
      return result.bytes;
    }
    errors.push(result.error);
  }

  console.error(
    '[brochure-pdf] mapbox static failed after retries:',
    `tokenSource=${resolved.source}`,
    `tokenIsPublic=${resolved.source === 'NEXT_PUBLIC_MAPBOX_TOKEN'}`,
    errors.join(' | '),
  );

  if (
    resolved.source === 'NEXT_PUBLIC_MAPBOX_TOKEN' &&
    errors.some((e) => e.startsWith('401') || e.startsWith('403'))
  ) {
    console.error(
      '[brochure-pdf] Hint: NEXT_PUBLIC_MAPBOX_TOKEN may have URL restrictions that block server-side fetches. Add MAPBOX_SECRET_TOKEN (sk.… or unrestricted pk.…) in Vercel for brochure PDFs.',
    );
  }

  return null;
}
