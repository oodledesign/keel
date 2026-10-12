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
  cover_photo_band: ['hero'],
  facts_table: ['photo1', 'photo2'],
  description_photo: ['photo'],
  photo_full: ['photo'],
  photo_grid_2: ['photo1', 'photo2'],
  photo_grid_3: ['photo1', 'photo2', 'photo3'],
  photo_row_3: ['photo1', 'photo2', 'photo3'],
  photo_grid_4: ['photo1', 'photo2', 'photo3', 'photo4'],
  photo_text: ['photo'],
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

function imageKey(slot: BrochureImageSlot): string {
  return slot.mediaId ?? slot.url ?? '';
}

function hasContent(slot: BrochureSlotValue): boolean {
  switch (slot.type) {
    case 'text':
      return Boolean(slot.text.trim());
    case 'image':
      return isFilledImage(slot);
    case 'facts':
      return slot.rows.length > 0;
    case 'map':
      return slot.amenities.length > 0 || slot.latitude != null;
    case 'agents':
      return false;
  }
}

/**
 * Change a page's layout, carrying its content across: slots with the same
 * key and type keep their value, and images fill the new layout's image
 * slots in order. Anything the new layout can't show is stashed on the page,
 * so switching back to a layout that can show it restores it.
 */
export function switchBrochurePageLayout(
  page: BrochurePage,
  layoutId: BrochureLayoutId,
): BrochurePage {
  if (page.layoutId === layoutId) return page;
  const blank = createBlankBrochurePage(layoutId);
  const kept: Record<string, BrochureSlotValue> = {
    ...page.stash,
    ...page.slots,
  };
  const slots: Record<string, BrochureSlotValue> = { ...blank.slots };

  for (const [key, slot] of Object.entries(blank.slots)) {
    const previous = kept[key];
    if (previous && previous.type === slot.type && slot.type !== 'image') {
      slots[key] = previous;
    }
  }

  const images = brochureImageSlotKeys(page.layoutId)
    .map((key) => page.slots[key])
    .filter(isFilledImage);
  const targetKeys = brochureImageSlotKeys(layoutId);
  targetKeys.forEach((key, index) => {
    const image = images[index];
    if (image) slots[key] = image;
  });

  const placed = new Set(
    Object.values(slots).filter(isFilledImage).map(imageKey),
  );
  for (const key of targetKeys) {
    const stashed = page.stash?.[key];
    if (isFilledImage(slots[key]) || !isFilledImage(stashed)) continue;
    if (placed.has(imageKey(stashed))) continue;
    slots[key] = stashed;
    placed.add(imageKey(stashed));
  }

  if (kept.shopfront && slots.shopfront) {
    slots.shopfront = kept.shopfront;
  }

  const stash: Record<string, BrochureSlotValue> = {};
  for (const [key, slot] of Object.entries(kept)) {
    if (key in slots || !hasContent(slot)) continue;
    if (isFilledImage(slot) && placed.has(imageKey(slot))) continue;
    stash[key] = slot;
  }

  const next: BrochurePage = { ...page, layoutId, slots };
  if (Object.keys(stash).length > 0) next.stash = stash;
  else delete next.stash;
  return next;
}

function withFreshUrls(
  slots: Record<string, BrochureSlotValue>,
  urlById: ReadonlyMap<string, string>,
): Record<string, BrochureSlotValue> {
  let out = slots;
  for (const [key, slot] of Object.entries(slots)) {
    if (slot.type !== 'image' || !slot.mediaId) continue;
    const url = urlById.get(slot.mediaId);
    if (!url || url === slot.url) continue;
    if (out === slots) out = { ...slots };
    out[key] = { ...slot, url };
  }
  return out;
}

/** Point image slots at freshly signed links. Returns `pages` itself when nothing changed. */
export function refreshBrochureMediaUrls(
  pages: BrochurePage[],
  urlById: ReadonlyMap<string, string>,
): BrochurePage[] {
  let changed = false;
  const next = pages.map((page) => {
    const slots = withFreshUrls(page.slots, urlById);
    const stash = page.stash && withFreshUrls(page.stash, urlById);
    if (slots === page.slots && stash === page.stash) return page;
    changed = true;
    return stash ? { ...page, slots, stash } : { ...page, slots };
  });
  return changed ? next : pages;
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
