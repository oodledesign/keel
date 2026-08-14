export const PRODUCT_TOUR_IDS = [
  'personal',
  'commercial_property',
  'work_design',
  'work_property',
  'default_landing_prompt',
  'personal_nav_tour_hint',
] as const;

export type ProductTourId = (typeof PRODUCT_TOUR_IDS)[number];

/** Tour variants that drive the UI (excludes prompt/dismiss meta keys). */
export type DriveableProductTourId = Exclude<
  ProductTourId,
  'default_landing_prompt' | 'personal_nav_tour_hint'
>;

export type CompletedProductTours = Partial<Record<ProductTourId, string>>;

export function isProductTourId(value: string): value is ProductTourId {
  return (PRODUCT_TOUR_IDS as readonly string[]).includes(value);
}

export function parseCompletedProductTours(
  raw: unknown,
): CompletedProductTours {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const result: CompletedProductTours = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isProductTourId(key) && typeof value === 'string' && value.trim()) {
      result[key] = value;
    }
  }
  return result;
}

export function hasCompletedProductTour(
  completed: CompletedProductTours,
  tourId: ProductTourId,
): boolean {
  return Boolean(completed[tourId]);
}
