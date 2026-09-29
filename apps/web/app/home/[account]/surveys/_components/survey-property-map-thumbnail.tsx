'use client';

import { useEffect, useState } from 'react';

import { MapPin } from 'lucide-react';

import { Skeleton } from '@kit/ui/skeleton';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? '';
const WIDTH = 128;
const HEIGHT = 96;

type Coordinates = { longitude: number; latitude: number };

const geocodeCache = new Map<string, Promise<Coordinates | null>>();

function geocode(query: string): Promise<Coordinates | null> {
  const cached = geocodeCache.get(query);
  if (cached) return cached;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('country', 'gb');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,postcode,place');

  const request = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then(
      (body: { features?: Array<{ center?: [number, number] }> } | null) => {
        const center = body?.features?.[0]?.center;
        return center ? { longitude: center[0], latitude: center[1] } : null;
      },
    )
    .catch(() => null)
    .then((coordinates) => {
      if (!coordinates) geocodeCache.delete(query);
      return coordinates;
    });

  geocodeCache.set(query, request);
  return request;
}

export function SurveyPropertyMapThumbnail({
  address,
  postcode,
}: {
  address: string | null;
  postcode: string | null;
}) {
  const query = [address?.trim(), postcode?.trim()].filter(Boolean).join(', ');
  const [result, setResult] = useState<{
    query: string;
    coordinates: Coordinates | null;
  } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !query) return;
    let cancelled = false;
    void geocode(query).then((coordinates) => {
      if (!cancelled) setResult({ query, coordinates });
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!MAPBOX_TOKEN || !query) return null;

  const loading = result?.query !== query;
  const coordinates = loading ? null : result.coordinates;

  if (loading) {
    return (
      <Skeleton
        className="shrink-0 rounded-lg bg-[var(--workspace-shell-sidebar-accent)]"
        style={{ width: WIDTH, height: HEIGHT }}
      />
    );
  }

  const src = coordinates
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+FF5C34(${coordinates.longitude},${coordinates.latitude})/${coordinates.longitude},${coordinates.latitude},15,0/${WIDTH}x${HEIGHT}@2x?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`
    : null;

  if (!coordinates || !src || failedSrc === src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
        style={{ width: WIDTH, height: HEIGHT }}
        title="Map unavailable for this address"
      >
        <MapPin className="h-4 w-4" />
      </div>
    );
  }

  const { longitude, latitude } = coordinates;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      className="group animate-in fade-in block shrink-0 overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] duration-200"
      style={{ width: WIDTH, height: HEIGHT }}
      title="Open in Google Maps"
      aria-label={`Open ${query} in Google Maps`}
      data-test="survey-property-map"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Map of ${query}`}
        width={WIDTH}
        height={HEIGHT}
        onError={() => setFailedSrc(src)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  );
}
