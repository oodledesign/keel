/** Applicant-facing requirement fields aligned with PropertyHive commercial intake. */

export const REQUIREMENT_PROPERTY_TYPES = [
  'Offices',
  'Industrial / Warehouse',
  'Retail',
  'Leisure',
  'Retail / Leisure',
  'Land',
  'Mixed use',
  'Investment',
  'Development',
] as const;

export type RequirementPropertyType =
  (typeof REQUIREMENT_PROPERTY_TYPES)[number];

export const REQUIREMENT_LOCATION_RADIUS_OPTIONS: ReadonlyArray<{
  miles: number;
  label: string;
}> = [
  { miles: 0, label: 'This area only' },
  { miles: 0.25, label: '¼ mile' },
  { miles: 0.5, label: '½ mile' },
  { miles: 1, label: '1 mile' },
  { miles: 2, label: '2 miles' },
  { miles: 3, label: '3 miles' },
  { miles: 4, label: '4 miles' },
  { miles: 5, label: '5 miles' },
  { miles: 10, label: '10 miles' },
  { miles: 15, label: '15 miles' },
  { miles: 20, label: '20 miles' },
  { miles: 25, label: '25 miles' },
  { miles: 30, label: '30 miles' },
  { miles: 40, label: '40 miles' },
  { miles: 50, label: '50 miles' },
];

export function tenureFromAvailability(
  forSale: boolean,
  toRent: boolean,
): 'rent' | 'buy' | 'both' | null {
  if (forSale && toRent) return 'both';
  if (forSale) return 'buy';
  if (toRent) return 'rent';
  return null;
}

export function availabilityFromTenure(tenure: 'rent' | 'buy' | 'both' | null) {
  return {
    forSale: tenure === 'buy' || tenure === 'both',
    toRent: tenure === 'rent' || tenure === 'both',
  };
}

export function radiusSelectValue(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return '0';
  const match = REQUIREMENT_LOCATION_RADIUS_OPTIONS.find(
    (option) => option.miles === miles,
  );
  return match ? String(match.miles) : String(miles);
}

/** Tight match for “this area only” (stored as 0 miles). */
export function effectiveSearchRadiusMiles(
  radius: number | null | undefined,
): number | null {
  if (radius == null || !Number.isFinite(radius)) return null;
  if (radius <= 0) return 0.5;
  return radius;
}
