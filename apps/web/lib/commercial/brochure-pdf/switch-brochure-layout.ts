import {
  type BrochureContentKind,
  brochureContentSectionLabel,
  contentOf,
  defaultLayoutFor,
} from '~/lib/commercial/brochure-pdf/brochure-content';
import type {
  BrochureImageSlot,
  BrochureLayoutId,
  BrochurePage,
  BrochureSlotValue,
  BrochureStashedContent,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { headingKeysFor } from '~/lib/commercial/brochure-pdf/brochure-headings';
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
  for (const key of headingKeysFor(layoutId)) {
    if (kept[key]?.type === 'text') slots[key] = kept[key];
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

/**
 * Change what a page is about. Its current content is put aside on the page;
 * the new content is what was put aside for it earlier, else `listingContent`,
 * else blank. Photos carry over into the new content's empty frames.
 */
export function switchBrochurePageContent(
  page: BrochurePage,
  kind: BrochureContentKind,
  listingContent?: Pick<BrochurePage, 'layoutId' | 'slots'> | null,
): BrochurePage {
  const from = contentOf(page.layoutId);
  if (from === kind) return page;

  const { [kind]: saved, ...others } = page.contentStash ?? {};
  const current: BrochureStashedContent = {
    layoutId: page.layoutId,
    slots: page.slots,
  };
  if (page.stash) current.stash = page.stash;

  const source =
    saved ?? listingContent ?? createBlankBrochurePage(defaultLayoutFor(kind));
  const slots = { ...source.slots };

  if (!saved) {
    const images = brochureImageSlotKeys(page.layoutId)
      .map((key) => page.slots[key])
      .filter(isFilledImage);
    const placed = new Set(
      Object.values(slots).filter(isFilledImage).map(imageKey),
    );
    for (const key of brochureImageSlotKeys(source.layoutId)) {
      if (isFilledImage(slots[key])) continue;
      const image = images.find((img) => !placed.has(imageKey(img)));
      if (!image) break;
      slots[key] = image;
      placed.add(imageKey(image));
    }
  }

  const next: BrochurePage = {
    ...page,
    layoutId: source.layoutId,
    slots,
    contentStash: { ...others, [from]: current },
  };
  if (saved?.stash) next.stash = saved.stash;
  else delete next.stash;
  if (page.sectionLabel) {
    next.sectionLabel = brochureContentSectionLabel(kind);
  }
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
    const contentStash =
      page.contentStash && withFreshContentUrls(page.contentStash, urlById);
    if (
      slots === page.slots &&
      stash === page.stash &&
      contentStash === page.contentStash
    ) {
      return page;
    }
    changed = true;
    const out: BrochurePage = { ...page, slots };
    if (stash) out.stash = stash;
    if (contentStash) out.contentStash = contentStash;
    return out;
  });
  return changed ? next : pages;
}

function withFreshContentUrls(
  contentStash: NonNullable<BrochurePage['contentStash']>,
  urlById: ReadonlyMap<string, string>,
): NonNullable<BrochurePage['contentStash']> {
  let out = contentStash;
  for (const [kind, saved] of Object.entries(contentStash) as Array<
    [BrochureContentKind, BrochureStashedContent]
  >) {
    const slots = withFreshUrls(saved.slots, urlById);
    const stash = saved.stash && withFreshUrls(saved.stash, urlById);
    if (slots === saved.slots && stash === saved.stash) continue;
    if (out === contentStash) out = { ...contentStash };
    out[kind] = stash ? { ...saved, slots, stash } : { ...saved, slots };
  }
  return out;
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
