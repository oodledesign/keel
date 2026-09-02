export type BrochureAmenityItem = {
  label: string;
  index: number;
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
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
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

export function sanitizeBrochureAmenities(
  amenities: Array<{ label: string; index: number }>,
  town?: string | null,
): BrochureAmenityItem[] {
  const cleaned = amenities
    .map((item) => ({
      label: item.label.trim(),
      index: item.index,
    }))
    .filter((item) => item.label && !isDummyLocalAreaAmenity(item.label))
    .slice(0, MAX_AMENITIES)
    .map((item, index) => ({ label: item.label, index: index + 1 }));

  if (cleaned.length > 0) return cleaned;
  return buildFallbackNearbyAmenities(town);
}
