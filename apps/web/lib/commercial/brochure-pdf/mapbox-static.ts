import 'server-only';

import {
  isPublicMapboxTokenSource,
  logMapboxServerAuthFailure,
  resolveMapboxToken,
} from '~/lib/commercial/brochure-pdf/mapbox-token';
import {
  type AmenityIcon,
  resolveAmenityIcon,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

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
  longitude?: number | null;
  latitude?: number | null;
  icon?: AmenityIcon | null;
};

export type FetchBrochureMapImageInput = {
  longitude: number;
  latitude: number;
  /** Pixel width (CSS px before @2x). */
  width: number;
  /** Pixel height. */
  height: number;
  zoom?: number;
  /** Amenities with coordinates get icon (or numbered) pins; the map then auto-fits. */
  amenities?: BrochureMapAmenity[];
  /** Workspace brand pin (`#RRGGBB` or `RRGGBB`). Overlay is `pin-l+RRGGBB`. */
  pinColor?: string;
  /** Amenity pin colour; defaults to the property pin colour. */
  amenityPinColor?: string;
};

const MAP_STYLES = ['mapbox/streets-v12', 'mapbox/light-v11'] as const;
const PIN_HEX_FALLBACK = '351E28';
/** Further places (airports, distant junctions) stay list-only. */
const AMENITY_PIN_MAX_KM = 6;
/** Space kept between the outermost pin and the map edge (CSS px). */
const PIN_FRAME_PADDING = 40;

/**
 * Property pin uses workspace brand primary (navy), not the coral accent.
 * Mapbox streets-v12 already uses red-ish POI dots — the pin must contrast.
 */
export function brochureMapPinColor(brand: {
  primaryColor?: string | null;
  accentColor?: string | null;
}): string {
  const primary = brand.primaryColor?.trim();
  if (primary) return primary;
  const accent = brand.accentColor?.trim();
  if (accent) return accent;
  return `#${PIN_HEX_FALLBACK}`;
}

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

function clampSize(n: number): number {
  return Math.min(1280, Math.max(200, Math.round(n)));
}

function roughKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = (b.latitude - a.latitude) * 111;
  const dLng =
    (b.longitude - a.longitude) * 111 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const coord = (n: number) => Number(n.toFixed(5));

type PinnedAmenity = {
  /** Maki icon name or the row number. */
  marker: string;
  latitude: number;
  longitude: number;
};

function pinnedAmenities(
  input: Pick<
    FetchBrochureMapImageInput,
    'latitude' | 'longitude' | 'amenities'
  >,
): PinnedAmenity[] {
  const origin = { latitude: input.latitude, longitude: input.longitude };
  const pinned: PinnedAmenity[] = [];
  for (const amenity of input.amenities ?? []) {
    const { latitude, longitude, index } = amenity;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 99
    ) {
      continue;
    }
    if (roughKm(origin, { latitude, longitude }) > AMENITY_PIN_MAX_KM) continue;
    pinned.push({
      marker: resolveAmenityIcon(amenity) ?? String(index),
      latitude,
      longitude,
    });
  }
  return pinned;
}

/** `pin-s-rail+HEX(lng,lat)` (or `pin-s-3+…`) overlays for amenities close enough to map. */
export function brochureAmenityPinOverlays(
  input: Pick<
    FetchBrochureMapImageInput,
    'latitude' | 'longitude' | 'amenities' | 'amenityPinColor' | 'pinColor'
  >,
): string[] {
  const hex = toMapboxPinHex(input.amenityPinColor ?? input.pinColor);
  return pinnedAmenities(input).map(
    ({ marker, latitude, longitude }) =>
      `pin-s-${marker}+${hex}(${coord(longitude)},${coord(latitude)})`,
  );
}

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const MAPBOX_TILE_PX = 512;
const PIN_ZOOM_MIN = 11;
const PIN_ZOOM_MAX = 15;

/**
 * Zoom that keeps every amenity pin in frame around the centred property
 * (Mapbox auto-fit would zoom to street level for a single close pin).
 */
export function brochureMapZoomForPins(
  input: Pick<
    FetchBrochureMapImageInput,
    'latitude' | 'longitude' | 'amenities' | 'width' | 'height'
  >,
): number | null {
  const pins = pinnedAmenities(input);
  if (pins.length === 0) return null;

  const cosLat = Math.cos((input.latitude * Math.PI) / 180);
  const halfW = Math.max(40, clampSize(input.width) / 2 - PIN_FRAME_PADDING);
  const halfH = Math.max(40, clampSize(input.height) / 2 - PIN_FRAME_PADDING);
  let zoom = PIN_ZOOM_MAX;
  for (const pin of pins) {
    const dxM = Math.abs(pin.longitude - input.longitude) * 111_320 * cosLat;
    const dyM = Math.abs(pin.latitude - input.latitude) * 110_574;
    for (const [meters, halfPx] of [
      [dxM, halfW],
      [dyM, halfH],
    ] as const) {
      if (meters < 1) continue;
      // Metres per CSS px at zoom z: C·cos(lat) / (512·2^z).
      const fit = Math.log2(
        (EARTH_CIRCUMFERENCE_M * cosLat * halfPx) / (MAPBOX_TILE_PX * meters),
      );
      zoom = Math.min(zoom, fit);
    }
  }
  return Math.max(PIN_ZOOM_MIN, Math.floor(zoom * 4) / 4);
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
  const amenityPins = brochureAmenityPinOverlays(input);
  const pinZoom = brochureMapZoomForPins(input);

  const urls: string[] = [];
  if (amenityPins.length > 0 && pinZoom != null) {
    // Property pin last so it draws on top of nearby amenity pins.
    const overlays = [...amenityPins, pin].join(',');
    for (const style of MAP_STYLES) {
      const base = `https://api.mapbox.com/styles/v1/${style}/static`;
      urls.push(
        `${base}/${overlays}/${lng},${lat},${pinZoom},0/${width}x${height}@2x?${tokenQs}`,
      );
    }
  }

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
      signal: AbortSignal.timeout(8000),
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
    `tokenIsPublic=${isPublicMapboxTokenSource(resolved.source)}`,
    errors.join(' | '),
  );

  const authError = errors.find(
    (error) => error.startsWith('401') || error.startsWith('403'),
  );
  if (authError) {
    const status = Number.parseInt(authError.slice(0, 3), 10);
    logMapboxServerAuthFailure(
      resolved.source,
      Number.isFinite(status) ? status : 401,
      'mapbox static',
    );
  }

  return null;
}
