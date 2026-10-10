import type {
  BrochureImageSlot,
  BrochureLayoutId,
  BrochurePage,
  BrochureSlotValue,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { createBlankBrochurePage } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

/** Listing-media image slots per layout, in reading order (no shopfront). */
const IMAGE_SLOT_KEYS: Partial<Record<BrochureLayoutId, string[]>> = {
  cover_hero_band: ['hero'],
  facts_table: ['photo1', 'photo2'],
  photo_full: ['photo'],
  photo_grid_2: ['photo1', 'photo2'],
  photo_grid_3: ['photo1', 'photo2', 'photo3'],
  floorplan: ['plan'],
};

export function brochureImageSlotKeys(layoutId: BrochureLayoutId): string[] {
  return IMAGE_SLOT_KEYS[layoutId] ?? [];
}

function isFilledImage(
  slot: BrochureSlotValue | undefined,
): slot is BrochureImageSlot {
  return slot?.type === 'image' && Boolean(slot.mediaId || slot.url);
}

/**
 * Change a page's layout, carrying its content across: slots with the same
 * key and type keep their value, and images fill the new layout's image
 * slots in order. Images beyond the new layout's capacity are dropped.
 */
export function switchBrochurePageLayout(
  page: BrochurePage,
  layoutId: BrochureLayoutId,
): BrochurePage {
  if (page.layoutId === layoutId) return page;
  const blank = createBlankBrochurePage(layoutId);
  const slots: Record<string, BrochureSlotValue> = { ...blank.slots };

  for (const [key, slot] of Object.entries(blank.slots)) {
    const previous = page.slots[key];
    if (previous && previous.type === slot.type && slot.type !== 'image') {
      slots[key] = previous;
    }
  }

  const images = brochureImageSlotKeys(page.layoutId)
    .map((key) => page.slots[key])
    .filter(isFilledImage);
  brochureImageSlotKeys(layoutId).forEach((key, index) => {
    const image = images[index];
    if (image) slots[key] = image;
  });

  if (page.slots.shopfront && slots.shopfront) {
    slots.shopfront = page.slots.shopfront;
  }

  return { ...page, layoutId, slots };
}

/** Put `media` in an image slot. Fit and focus belonged to the old image. */
export function placeBrochureMedia(
  media: BrochureMediaItem,
): BrochureImageSlot {
  return { type: 'image', mediaId: media.id, url: media.url };
}

export type BrochureSlotRef = { pageId: string; key: string };

/** Swap two image slots (same page or across pages), keeping fit and focus with each image. */
export function swapBrochureImageSlots(
  pages: BrochurePage[],
  a: BrochureSlotRef,
  b: BrochureSlotRef,
): BrochurePage[] {
  const pageA = pages.find((p) => p.id === a.pageId);
  const pageB = pages.find((p) => p.id === b.pageId);
  const slotA = pageA?.slots[a.key];
  const slotB = pageB?.slots[b.key];
  if (slotA?.type !== 'image' || slotB?.type !== 'image') return pages;
  if (a.pageId === b.pageId && a.key === b.key) return pages;

  return pages.map((p) => {
    if (p.id !== a.pageId && p.id !== b.pageId) return p;
    const slots = { ...p.slots };
    if (p.id === a.pageId) slots[a.key] = slotB;
    if (p.id === b.pageId) slots[b.key] = slotA;
    return { ...p, slots };
  });
}
