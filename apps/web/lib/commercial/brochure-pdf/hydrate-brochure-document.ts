import type {
  BrochureDocument,
  BrochureImageSlot,
  BrochurePage,
  BrochureSlotValue,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { brochureLocationBody } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import {
  amenityDedupeKey,
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
};

const FACTS_PHOTO_KEYS = ['photo1', 'photo2'];

function isImageSlot(
  slot: BrochureSlotValue | undefined,
): slot is BrochureImageSlot {
  return slot?.type === 'image';
}

/** Fresh media URL on the slot, keeping the editor's fit and focus. */
function mediaSlot(
  item: BrochureMediaItem,
  slot?: BrochureImageSlot,
): BrochureImageSlot {
  return { ...slot, type: 'image', mediaId: item.id, url: item.url };
}

function hasImageUrl(slot: BrochureSlotValue | undefined): boolean {
  return isImageSlot(slot) && Boolean(slot.url?.trim());
}

type MapAmenity = Extract<
  BrochureSlotValue,
  { type: 'map' }
>['amenities'][number];

/** Saved pages predating map pins / icons: borrow them from matching fetched places. */
function attachAmenityCoordinates(
  saved: MapAmenity[],
  fetched: NonNullable<PublicBrochureData['nearbyAmenities']>,
): MapAmenity[] {
  const byKey = new Map(
    fetched.map((item) => [amenityDedupeKey(item.label), item]),
  );
  return saved.map((item) => {
    const match = byKey.get(amenityDedupeKey(item.label));
    if (!match) return item;
    const next = { ...item };
    if (
      (next.latitude == null || next.longitude == null) &&
      match.latitude != null &&
      match.longitude != null
    ) {
      next.latitude = match.latitude;
      next.longitude = match.longitude;
    }
    if (!next.icon && match.icon) next.icon = match.icon;
    return next;
  });
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
  // The wizard can place any photo or plan in any image slot.
  const mediaById = new Map([...floorplanById, ...imageById]);
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
  ): BrochureSlotValue | undefined => {
    if (!isImageSlot(slot)) return slot;

    if (slot.mediaId && mediaById.has(slot.mediaId)) {
      const media = mediaById.get(slot.mediaId)!;
      used.add(media.id);
      return mediaSlot(media, slot);
    }

    if (slot.url?.trim()) {
      return slot;
    }

    if (fallback) {
      used.add(fallback.id);
      return mediaSlot(fallback, slot);
    }

    return slot;
  };

  const pages: BrochurePage[] = document.pages.map((page) => {
    const slots = { ...page.slots };
    const keys = PHOTO_SLOT_KEYS[page.layoutId] ?? [];

    if (page.layoutId === 'cover_hero_band') {
      const resolved = resolve(slots.hero, cover);
      if (resolved) slots.hero = resolved;
    } else if (page.layoutId === 'floorplan') {
      const preferred =
        (isImageSlot(slots.plan) && slots.plan.mediaId
          ? (floorplanById.get(slots.plan.mediaId) ?? null)
          : null) ??
        floorplans[0] ??
        null;
      const resolved = resolve(slots.plan, preferred);
      if (resolved) slots.plan = resolved;
    } else if (page.layoutId === 'contact') {
      const shopfront = data.branch?.shopfrontUrl?.trim() || null;
      const existing = slots.shopfront;
      const lockedToListingMedia =
        isImageSlot(existing) && Boolean(existing.mediaId);
      // Branch settings are the source of truth unless the editor pinned a
      // listing photo on this slot. Always refresh the public URL.
      if (!lockedToListingMedia) {
        slots.shopfront = { type: 'image', mediaId: null, url: shopfront };
      }
    } else if (page.layoutId === 'facts_table') {
      // Optional side photos: refresh by mediaId, never back-fill.
      for (const key of FACTS_PHOTO_KEYS) {
        const resolved = resolve(slots[key], null);
        if (resolved) slots[key] = resolved;
      }
    } else if (keys.length > 0 && page.layoutId.startsWith('photo_')) {
      for (const key of keys) {
        const slot = slots[key];
        const canResolve =
          isImageSlot(slot) &&
          ((slot.mediaId && mediaById.has(slot.mediaId)) ||
            Boolean(slot.url?.trim()));
        const resolved = resolve(slot, canResolve ? null : takeNext(images));
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
      } else {
        slots.map = {
          ...slots.map,
          amenities: attachAmenityCoordinates(slots.map.amenities, fetched),
        };
      }
    }

    if (
      page.layoutId === 'map_amenities' &&
      !(slots.body?.type === 'text' && slots.body.text.trim())
    ) {
      const location = brochureLocationBody(data).slice(0, 800);
      if (location) slots.body = { type: 'text', text: location };
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
