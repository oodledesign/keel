/** Mapbox Maki icon names, valid as Static Images pin labels. */
export const AMENITY_ICONS = [
  'rail',
  'car',
  'town',
  'airport',
  'grocery',
  'hospital',
  'school',
  'park',
] as const;

export type AmenityIcon = (typeof AMENITY_ICONS)[number];

export type BrochureAmenityItem = {
  label: string;
  index: number;
  /** When set, the map page drops a pin here. */
  latitude?: number | null;
  longitude?: number | null;
  /** Pin + legend icon; numbered when unknown. */
  icon?: AmenityIcon | null;
};

const DUMMY_LOCAL_AREA_RE = /^local area\s*\(/i;
const MAX_AMENITIES = 8;

/** Street names and parking ("Park Road", "Park and Ride") never get a guessed icon. */
const NOT_AN_AMENITY_RE =
  /\b(road|lane|street|avenue|drive|way|close|crescent)$|\b(car park|parking|park and ride)\b/i;

const ICON_FROM_LABEL: ReadonlyArray<[RegExp, AmenityIcon]> = [
  [/\bairport\b/i, 'airport'],
  [/\bstation$/i, 'rail'],
  [/^M\d+[A-Z]?\b|\bjunction\b/i, 'car'],
  [/\b(town|city) centre\b/i, 'town'],
  [/\bhospital\b/i, 'hospital'],
  [/\b(school|academy|college)\b/i, 'school'],
  [
    /\b(tesco|sainsbury'?s|asda|morrisons|waitrose|aldi|lidl|co-?op|m&s food|iceland|supermarket)\b/i,
    'grocery',
  ],
  [
    /(?<!\bcar )\b(park|gardens|common|green|recreation ground|playing fields?|nature reserve)\b/i,
    'park',
  ],
];

export function isAmenityIcon(value: unknown): value is AmenityIcon {
  return (
    typeof value === 'string' &&
    (AMENITY_ICONS as readonly string[]).includes(value)
  );
}

/** Explicit icon, else a best guess from the place name (pre-icon saved pages, manual rows). */
export function resolveAmenityIcon(item: {
  label: string;
  icon?: AmenityIcon | null;
}): AmenityIcon | null {
  if (isAmenityIcon(item.icon)) return item.icon;
  const name = (item.label.split(/\s+·\s+/)[0] ?? item.label).trim();
  if (NOT_AN_AMENITY_RE.test(name)) return null;
  return ICON_FROM_LABEL.find(([re]) => re.test(name))?.[1] ?? null;
}

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

type AmenityInput = string | Omit<BrochureAmenityItem, 'index'>;

export function buildFallbackNearbyAmenities(
  town: string | null | undefined,
  extraPois: AmenityInput[] = [],
): BrochureAmenityItem[] {
  const items: BrochureAmenityItem[] = [];
  const seen = new Set<string>();

  const push = (input: AmenityInput) => {
    const { label, ...rest } =
      typeof input === 'string' ? { label: input } : input;
    const trimmed = label.trim();
    if (!trimmed || isDummyLocalAreaAmenity(trimmed)) return;
    const key = amenityDedupeKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ ...rest, label: trimmed, index: items.length + 1 });
  };

  const townName = town?.trim();
  if (townName) {
    push({ label: `${townName} town centre`, icon: 'town' });
  }

  for (const poi of extraPois) {
    if (items.length >= MAX_AMENITIES) break;
    push(poi);
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
      const cleanedItem: BrochureAmenityItem = {
        label: item.label,
        index: index + 1,
      };
      if (latitude != null && longitude != null) {
        cleanedItem.latitude = latitude;
        cleanedItem.longitude = longitude;
      }
      if (isAmenityIcon(item.icon)) cleanedItem.icon = item.icon;
      return cleanedItem;
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
