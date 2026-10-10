/**
 * Local-area facts for brochures (stations, motorways, town centre, airport).
 * Pure helpers — the dataset lookup lives in `local-area.ts`.
 */
import type { AmenityIcon } from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

export type LocalAreaPlaceKind = 'station' | 'motorway' | 'town' | 'airport';

export type LocalAreaPlace = {
  kind: LocalAreaPlaceKind;
  name: string;
  km: number;
  latitude: number;
  longitude: number;
  /** Bearing in degrees from the property to the place. */
  bearing: number;
  /** Town places only: say "city centre" rather than "town centre". */
  isCity?: boolean;
};

export type LocalAreaFacts = {
  /** Village / suburb the property sits in, when it differs from the town. */
  locality: string | null;
  places: LocalAreaPlace[];
};

export type LocalAreaAmenity = {
  label: string;
  index: number;
  latitude: number;
  longitude: number;
  icon: AmenityIcon;
};

const KIND_ICON: Record<LocalAreaPlaceKind, AmenityIcon> = {
  station: 'rail',
  motorway: 'car',
  town: 'town',
  airport: 'airport',
};

/** Precomputed local-area copy carried on brochure data. */
export type BrochureLocalArea = {
  /** Factual agency-style paragraph (straight-line distances). */
  summary: string;
  /** Plain lines for AI prompts and the editor. */
  factLines: string[];
};

const KM_PER_MILE = 1.609344;
/** Walking speed 4.8 km/h with a 1.25 detour factor on straight-line distance. */
const WALK_KM_PER_MIN = 4.8 / 60 / 1.25;
const MAX_WALK_MINUTES = 25;

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export function compassWord(bearing: number): string {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index]!;
}

export function walkMinutes(km: number): number {
  return Math.max(1, Math.round(km / WALK_KM_PER_MIN));
}

export function milesFromKm(km: number): number {
  return km / KM_PER_MILE;
}

/** Short distance for lists: "0.3 mi", "12 mi". */
export function shortDistance(km: number): string {
  const miles = milesFromKm(km);
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Agency-style distance for prose: "500 yards", "2.8 miles". */
export function proseDistance(km: number): string {
  const miles = milesFromKm(km);
  if (miles < 0.5) {
    const yards = Math.max(50, Math.round((miles * 1760) / 50) * 50);
    return `${yards} yards`;
  }
  if (miles < 10) {
    const rounded = Math.round(miles * 2) / 2;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${rounded === 1 ? 'mile' : 'miles'}`;
  }
  return `${Math.round(miles)} miles`;
}

export function placeDisplayName(place: LocalAreaPlace): string {
  if (place.kind === 'town') {
    return `${place.name} ${place.isCity ? 'city' : 'town'} centre`;
  }
  return place.name;
}

export function placeDistanceDetail(place: LocalAreaPlace): string {
  const distance = shortDistance(place.km);
  if (place.kind === 'station') {
    const minutes = walkMinutes(place.km);
    if (minutes <= MAX_WALK_MINUTES) {
      return `${distance} · ${minutes} min walk`;
    }
  }
  return distance;
}

export function placeAmenityLabel(place: LocalAreaPlace): string {
  return `${placeDisplayName(place)} · ${placeDistanceDetail(place)}`;
}

const KIND_ORDER: Record<LocalAreaPlaceKind, number> = {
  station: 0,
  town: 1,
  motorway: 2,
  airport: 3,
};

function orderedPlaces(facts: LocalAreaFacts): LocalAreaPlace[] {
  return [...facts.places].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.km - b.km,
  );
}

/** Ordered, numbered amenity rows (stations first) with map coordinates. */
export function localAreaAmenities(
  facts: LocalAreaFacts,
  max = 8,
): LocalAreaAmenity[] {
  return orderedPlaces(facts)
    .slice(0, max)
    .map((place, i) => ({
      label: placeAmenityLabel(place),
      index: i + 1,
      latitude: place.latitude,
      longitude: place.longitude,
      icon: KIND_ICON[place.kind],
    }));
}

/** "M25 Junction 5" -> "Junction 5 of the M25". */
export function motorwayProseName(name: string): string {
  const match = /^(.+?) Junction (\S+)$/.exec(name.trim());
  if (!match) return name;
  return `Junction ${match[2]} of the ${match[1]}`;
}

function sameName(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a && b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();
}

/**
 * Factual, agency-style location paragraph built only from looked-up places.
 * Distances are straight-line approximations, so the copy says "approximately".
 */
export function buildLocationSummary(
  facts: LocalAreaFacts,
  town: string | null | undefined,
): string {
  const sentences: string[] = [];
  const townPlace = facts.places.find((p) => p.kind === 'town');
  const locality = facts.locality?.trim() || null;

  if (townPlace && townPlace.km >= 0.8) {
    const direction = compassWord((townPlace.bearing + 180) % 360);
    const where =
      locality && !sameName(locality, townPlace.name)
        ? `in ${locality}, approximately`
        : 'approximately';
    sentences.push(
      `The property is situated ${where} ${proseDistance(townPlace.km)} ${direction} of ${placeDisplayName(townPlace)}.`,
    );
  } else if (townPlace) {
    sentences.push(
      `The property is situated in ${placeDisplayName(townPlace)}.`,
    );
  } else if (locality) {
    sentences.push(`The property is situated in ${locality}.`);
  } else if (town?.trim()) {
    sentences.push(`The property is situated in ${town.trim()}.`);
  }

  const stations = facts.places
    .filter((p) => p.kind === 'station')
    .sort((a, b) => a.km - b.km);
  const nearest = stations[0];
  if (nearest) {
    const minutes = walkMinutes(nearest.km);
    const walk =
      minutes <= MAX_WALK_MINUTES ? ` (around a ${minutes} minute walk)` : '';
    const direction = compassWord(nearest.bearing);
    sentences.push(
      `${nearest.name} is approximately ${proseDistance(nearest.km)} to the ${direction}${walk}.`,
    );
  }

  const motorways = facts.places
    .filter((p) => p.kind === 'motorway')
    .sort((a, b) => a.km - b.km)
    .slice(0, 2);
  if (motorways.length === 1) {
    sentences.push(
      `${motorwayProseName(motorways[0]!.name)} is approximately ${proseDistance(motorways[0]!.km)} away.`,
    );
  } else if (motorways.length === 2) {
    sentences.push(
      `${motorwayProseName(motorways[0]!.name)} and ${motorwayProseName(motorways[1]!.name)} are approximately ${proseDistance(motorways[0]!.km)} and ${proseDistance(motorways[1]!.km)} away respectively.`,
    );
  }

  const airport = facts.places.find((p) => p.kind === 'airport');
  if (airport) {
    sentences.push(
      `${airport.name} is approximately ${proseDistance(airport.km)} away.`,
    );
  }

  return sentences.join(' ');
}

/** Plain facts for AI copy prompts, e.g. "Otford station: 0.3 mi, 7 min walk, east". */
export function localAreaFactLines(facts: LocalAreaFacts): string[] {
  const lines: string[] = [];
  if (facts.locality) lines.push(`Locality: ${facts.locality}`);
  for (const place of orderedPlaces(facts)) {
    const detail = placeDistanceDetail(place).replace(' · ', ', ');
    lines.push(
      `${placeDisplayName(place)}: ${detail}, ${compassWord(place.bearing)} (straight-line)`,
    );
  }
  return lines;
}

export function buildBrochureLocalArea(
  facts: LocalAreaFacts,
  town: string | null | undefined,
): BrochureLocalArea {
  return {
    summary: buildLocationSummary(facts, town),
    factLines: localAreaFactLines(facts),
  };
}
