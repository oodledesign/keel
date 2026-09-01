export type BrochureAmenityItem = {
  label: string;
  index: number;
};

const DUMMY_LOCAL_AREA_RE = /^local area\s*\(/i;
const MAX_AMENITIES = 6;

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

export function buildFallbackNearbyAmenities(
  town: string | null | undefined,
): BrochureAmenityItem[] {
  const trimmed = town?.trim();
  if (!trimmed) return [];
  return [{ label: `${trimmed} town centre`, index: 1 }];
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
