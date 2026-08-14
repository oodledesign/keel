'use client';

import { useMemo } from 'react';

import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox';

import 'mapbox-gl/dist/mapbox-gl.css';

import { MapPin } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? '';

type MapPinItem = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  selected?: boolean;
};

export function RequirementMatchesMap({
  pins,
  center,
  radiusMiles,
}: {
  pins: MapPinItem[];
  center?: { latitude: number; longitude: number } | null;
  radiusMiles?: number | null;
}) {
  const initialViewState = useMemo(() => {
    if (center) {
      return {
        longitude: center.longitude,
        latitude: center.latitude,
        zoom: radiusMiles && radiusMiles <= 10 ? 10 : 8,
      };
    }
    if (pins[0]) {
      return {
        longitude: pins[0].longitude,
        latitude: pins[0].latitude,
        zoom: 8,
      };
    }
    return { longitude: -1.5, latitude: 52.5, zoom: 5.5 };
  }, [center, pins, radiusMiles]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs text-[var(--workspace-shell-text)]/50">
        Add NEXT_PUBLIC_MAPBOX_TOKEN to show matches on a map
      </div>
    );
  }

  if (pins.length === 0 && !center) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text)]/45">
        <MapPin className="h-4 w-4" />
        No mapped stock in this shortlist
      </div>
    );
  }

  return (
    <div className="h-52 overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
      <MapboxMap
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {center ? (
          <Marker
            longitude={center.longitude}
            latitude={center.latitude}
            anchor="center"
          >
            <span
              className="block h-3 w-3 rounded-full border-2 border-white bg-[var(--ozer-accent)] shadow"
              title="Requirement centre"
            />
          </Marker>
        ) : null}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            longitude={pin.longitude}
            latitude={pin.latitude}
            anchor="center"
          >
            <span
              className={`block rounded-full border-2 border-white shadow ${
                pin.selected
                  ? 'h-3.5 w-3.5 bg-[var(--ozer-accent)]'
                  : 'h-3 w-3 bg-[var(--ozer-info)]'
              }`}
              title={pin.name}
            />
          </Marker>
        ))}
      </MapboxMap>
    </div>
  );
}
