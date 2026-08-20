/**
 * Google Maps Street View links. Opening Maps is free.
 * In-page embed uses the same unauthenticated iframe pattern as listing maps.
 */

export function googleStreetViewMapsUrl(input: {
  panoId?: string | null;
  heading?: number | null;
  pitch?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  if (input.panoId?.trim()) {
    const params = new URLSearchParams({
      api: '1',
      map_action: 'pano',
      pano: input.panoId.trim(),
    });
    if (input.heading != null) params.set('heading', String(input.heading));
    if (input.pitch != null) params.set('pitch', String(input.pitch));
    return `https://www.google.com/maps/@?${params.toString()}`;
  }

  if (input.latitude != null && input.longitude != null) {
    const params = new URLSearchParams({
      api: '1',
      map_action: 'pano',
      viewpoint: `${input.latitude},${input.longitude}`,
    });
    if (input.heading != null) params.set('heading', String(input.heading));
    if (input.pitch != null) params.set('pitch', String(input.pitch));
    return `https://www.google.com/maps/@?${params.toString()}`;
  }

  return null;
}

export function googleStreetViewEmbedUrl(input: {
  panoId?: string | null;
  heading?: number | null;
  pitch?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  const heading = input.heading ?? 0;
  const pitch = input.pitch ?? 0;
  if (input.latitude != null && input.longitude != null) {
    return `https://maps.google.com/maps?layer=c&cbll=${input.latitude},${input.longitude}&cbp=11,${heading},0,0,${pitch}&output=svembed`;
  }
  if (input.panoId?.trim()) {
    return `https://maps.google.com/maps?layer=c&panoid=${encodeURIComponent(input.panoId.trim())}&cbp=11,${heading},0,0,${pitch}&output=svembed`;
  }
  return null;
}
