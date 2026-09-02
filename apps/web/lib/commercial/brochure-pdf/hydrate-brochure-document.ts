import type {
  BrochureDocument,
  BrochurePage,
  BrochureSlotValue,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  buildFallbackNearbyAmenities,
  isThinNearbyAmenityList,
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
import type {
  BrochureMediaItem,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

const PHOTO_LAYOUTS = new Set(['photo_full', 'photo_grid_2', 'photo_grid_3']);

const PHOTO_SLOT_KEYS: Record<string, string[]> = {
  cover_hero_band: ['hero'],
  photo_full: ['photo'],
  photo_grid_2: ['photo1', 'photo2'],
  photo_grid_3: ['photo1', 'photo2', 'photo3'],
  floorplan: ['plan'],
  contact: ['shopfront'],
};

function isImageSlot(
  slot: BrochureSlotValue | undefined,
): slot is Extract<BrochureSlotValue, { type: 'image' }> {
  return slot?.type === 'image';
}

function mediaSlot(item: BrochureMediaItem): BrochureSlotValue {
  return { type: 'image', mediaId: item.id, url: item.url };
}

function hasImageUrl(slot: BrochureSlotValue | undefined): boolean {
  return isImageSlot(slot) && Boolean(slot.url?.trim());
}

/**
 * Fill empty / stale image slots from current listing media so a saved
 * landscape layout with null heroes still paints the cover and gallery.
 * Re-resolves URLs by mediaId (signed URLs in saved pages expire).
 */
export function hydrateBrochureDocument(
  document: BrochureDocument,
  data: PublicBrochureData,
): BrochureDocument {
  const images = data.images;
  const floorplans = data.floorplans;
  const cover = images.find((item) => item.isCover) ?? images[0] ?? null;
  const imageById = new Map(images.map((item) => [item.id, item]));
  const floorplanById = new Map(floorplans.map((item) => [item.id, item]));
  const used = new Set<string>();

  const takeNext = (pool: BrochureMediaItem[]): BrochureMediaItem | null => {
    const next =
      pool.find((item) => !used.has(item.id) && !item.isCover) ??
      pool.find((item) => !used.has(item.id)) ??
      null;
    if (next) used.add(next.id);
    return next;
  };

  const resolve = (
    slot: BrochureSlotValue | undefined,
    fallback: BrochureMediaItem | null,
    pool: Map<string, BrochureMediaItem>,
  ): BrochureSlotValue | undefined => {
    if (!isImageSlot(slot)) return slot;

    if (slot.mediaId && pool.has(slot.mediaId)) {
      const media = pool.get(slot.mediaId)!;
      used.add(media.id);
      return mediaSlot(media);
    }

    if (slot.url?.trim()) {
      return slot;
    }

    if (fallback) {
      used.add(fallback.id);
      return mediaSlot(fallback);
    }

    return slot;
  };

  const pages: BrochurePage[] = document.pages.map((page) => {
    const slots = { ...page.slots };
    const keys = PHOTO_SLOT_KEYS[page.layoutId] ?? [];

    if (page.layoutId === 'cover_hero_band') {
      const resolved = resolve(slots.hero, cover, imageById);
      if (resolved) slots.hero = resolved;
    } else if (page.layoutId === 'floorplan') {
      const preferred =
        (isImageSlot(slots.plan) && slots.plan.mediaId
          ? (floorplanById.get(slots.plan.mediaId) ?? null)
          : null) ??
        floorplans[0] ??
        null;
      const resolved = resolve(slots.plan, preferred, floorplanById);
      if (resolved) slots.plan = resolved;
    } else if (page.layoutId === 'contact') {
      const shopfront = data.branch?.shopfrontUrl?.trim() || null;
      if (!hasImageUrl(slots.shopfront) && shopfront) {
        slots.shopfront = { type: 'image', mediaId: null, url: shopfront };
      }
    } else if (keys.length > 0 && page.layoutId.startsWith('photo_')) {
      for (const key of keys) {
        const slot = slots[key];
        const canResolve =
          isImageSlot(slot) &&
          ((slot.mediaId && imageById.has(slot.mediaId)) ||
            Boolean(slot.url?.trim()));
        const resolved = resolve(
          slot,
          canResolve ? null : takeNext(images),
          imageById,
        );
        if (resolved) slots[key] = resolved;
      }
    }

    if (page.layoutId === 'map_amenities' && slots.map?.type === 'map') {
      const fetched = data.nearbyAmenities ?? [];
      if (isThinNearbyAmenityList(slots.map.amenities)) {
        const amenities =
          fetched.length > 0
            ? sanitizeBrochureAmenities(fetched, data.listing.town)
            : buildFallbackNearbyAmenities(data.listing.town, fetched);
        slots.map = { ...slots.map, amenities };
      }
    }

    return { ...page, slots };
  });

  const filtered = pages.filter((page) => {
    if (!PHOTO_LAYOUTS.has(page.layoutId)) return true;
    return (PHOTO_SLOT_KEYS[page.layoutId] ?? []).some((key) =>
      hasImageUrl(page.slots[key]),
    );
  });

  return { ...document, pages: filtered };
}
