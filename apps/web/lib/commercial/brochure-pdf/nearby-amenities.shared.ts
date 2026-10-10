export type BrochureAmenityItem = {
  label: string;
  index: number;
  /** When set, the map page drops a numbered pin here. */
  latitude?: number | null;
  longitude?: number | null;
};

const DUMMY_LOCAL_AREA_RE = /^local area\s*\(/i;
const MAX_AMENITIES = 8;

export function isDummyLocalAreaAmenity(label: string): boolean {
  return DUMMY_LOCAL_AREA_RE.test(label.trim());
}

export function formatAmenityDistanceMiles(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  const miles = km * 0.621371;
  if (miles < 0.05) return 'nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatNearbyAmenityLabel(
  name: string,
  distanceLabel: string,
): string {
  const trimmed = name.trim();
  if (!trimmed) return distanceLabel;
  if (!distanceLabel) return trimmed;
  return `${trimmed} · ${distanceLabel}`;
}

const TOWN_CENTRE_RE = /town centre$/i;

export function isTownCentreAmenity(label: string): boolean {
  return TOWN_CENTRE_RE.test(label.trim());
}

/** Stable key for merge/dedupe — strips distance and railway/train wording. */
export function amenityDedupeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*[·•]\s*.+$/, '')
    .replace(/\b(?:railway|train)\s+station\b/g, 'station')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the list is empty or only a town-centre / dummy line — i.e. we
 * should still merge in Mapbox POIs when they exist.
 */
export function isThinNearbyAmenityList(
  amenities: Array<{ label: string }> | null | undefined,
): boolean {
  if (!amenities?.length) return true;
  const cleaned = amenities
    .map((item) => item.label.trim())
    .filter((label) => label && !isDummyLocalAreaAmenity(label));
  if (cleaned.length === 0) return true;
  return cleaned.every((label) => isTownCentreAmenity(label));
}

export function buildFallbackNearbyAmenities(
  town: string | null | undefined,
  extraPois: Array<string | { label: string }> = [],
): BrochureAmenityItem[] {
  const items: BrochureAmenityItem[] = [];
  const seen = new Set<string>();

  const push = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || isDummyLocalAreaAmenity(trimmed)) return;
    const key = amenityDedupeKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ label: trimmed, index: items.length + 1 });
  };

  const townName = town?.trim();
  if (townName) {
    push(`${townName} town centre`);
  }

  for (const poi of extraPois) {
    if (items.length >= MAX_AMENITIES) break;
    push(typeof poi === 'string' ? poi : poi.label);
  }

  return items;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function sanitizeBrochureAmenities(
  amenities: BrochureAmenityItem[],
  town?: string | null,
): BrochureAmenityItem[] {
  const cleaned = amenities
    .map((item) => ({ ...item, label: item.label.trim() }))
    .filter((item) => item.label && !isDummyLocalAreaAmenity(item.label))
    .slice(0, MAX_AMENITIES)
    .map((item, index) => {
      const latitude = finiteOrNull(item.latitude);
      const longitude = finiteOrNull(item.longitude);
      return latitude != null && longitude != null
        ? { label: item.label, index: index + 1, latitude, longitude }
        : { label: item.label, index: index + 1 };
    });

  if (cleaned.length > 0) return cleaned;
  return buildFallbackNearbyAmenities(town);
}

/**
 * Dataset places first (they carry map coordinates), then Mapbox POIs that
 * add something new. Mapbox's town-centre fallback and stations are dropped
 * when the dataset already covers them.
 */
export function mergeBrochureAmenities(
  primary: BrochureAmenityItem[],
  secondary: BrochureAmenityItem[],
  max = MAX_AMENITIES,
): BrochureAmenityItem[] {
  const seen = new Set(primary.map((item) => amenityDedupeKey(item.label)));
  const hasStation = primary.some((item) => /\bstation\b/i.test(item.label));
  const hasTown = primary.some((item) =>
    / (town|city) centre\b/i.test(item.label),
  );
  const merged = [...primary];

  for (const item of secondary) {
    if (merged.length >= max) break;
    const key = amenityDedupeKey(item.label);
    if (!key || seen.has(key)) continue;
    if (hasStation && /\bstation\b/i.test(item.label)) continue;
    if (hasTown && isTownCentreAmenity(item.label)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged
    .slice(0, max)
    .map((item, index) => ({ ...item, index: index + 1 }));
}
