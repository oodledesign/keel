import 'server-only';

/**
 * Mapbox Static Images API helper for brochure map pages.
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
};

function mapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  return token || null;
}

/**
 * Build a Static Images API URL with numbered property + amenity pins.
 */
export function buildBrochureMapStaticUrl(
  input: FetchBrochureMapImageInput,
): string | null {
  const token = mapboxToken();
  if (!token) return null;

  const width = Math.min(1280, Math.max(200, Math.round(input.width)));
  const height = Math.min(1280, Math.max(200, Math.round(input.height)));
  const zoom = input.zoom ?? 13;

  const overlays: string[] = [
    `pin-l-building+FF5C34(${input.longitude},${input.latitude})`,
  ];

  for (const amenity of input.amenities ?? []) {
    if (
      amenity.longitude == null ||
      amenity.latitude == null ||
      !Number.isFinite(amenity.longitude) ||
      !Number.isFinite(amenity.latitude)
    ) {
      continue;
    }
    const n = Math.min(99, Math.max(1, amenity.index));
    overlays.push(
      `pin-s-${n}+351E28(${amenity.longitude},${amenity.latitude})`,
    );
  }

  const overlayPath = overlays.join(',');
  const style = 'mapbox/light-v11';

  return `https://api.mapbox.com/styles/v1/${style}/static/${overlayPath}/${input.longitude},${input.latitude},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}

/**
 * Fetch map PNG bytes for embedding in the PDF.
 */
export async function fetchBrochureMapImageBytes(
  input: FetchBrochureMapImageInput,
): Promise<Uint8Array | null> {
  const url = buildBrochureMapStaticUrl(input);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      // Map tiles are public with token; cache briefly on the edge/server
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(
        '[brochure-pdf] mapbox static fetch failed:',
        res.status,
        await res.text().catch(() => ''),
      );
      return null;
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.error(
      '[brochure-pdf] mapbox static error:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
