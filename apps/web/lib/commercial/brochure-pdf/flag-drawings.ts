import 'server-only';

import { fetchBrochureImageBytes } from '~/lib/commercial/brochure-pdf/brochure-image-bytes';
import { isDrawingImage } from '~/lib/commercial/brochure-pdf/image-kind';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

const CACHE_LIMIT = 2000;
const CONCURRENCY = 6;

/** Keyed by media id + storage path; signed-URL query strings vary per call. */
const drawingCache = new Map<string, boolean>();

function cacheKey(item: BrochureMediaItem): string {
  return `${item.id}:${item.url.split('?')[0]}`;
}

function remember(key: string, value: boolean) {
  if (drawingCache.size >= CACHE_LIMIT) {
    const oldest = drawingCache.keys().next().value;
    if (oldest !== undefined) drawingCache.delete(oldest);
  }
  drawingCache.set(key, value);
}

async function detect(item: BrochureMediaItem): Promise<boolean> {
  const key = cacheKey(item);
  const cached = drawingCache.get(key);
  if (cached !== undefined) return cached;
  const bytes = await fetchBrochureImageBytes(item.url);
  if (!bytes) return false;
  const drawing = await isDrawingImage(bytes);
  remember(key, drawing);
  return drawing;
}

/**
 * Sets `isDrawing` on listing media. Floor plans are drawings by definition;
 * photos are classified from their pixels.
 */
export async function flagBrochureDrawings(
  items: BrochureMediaItem[],
): Promise<BrochureMediaItem[]> {
  const out = items.map((item) =>
    item.mediaType === 'floorplan' ? { ...item, isDrawing: true } : item,
  );
  const pending = out
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.mediaType === 'image');

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + CONCURRENCY).map(async ({ item, index }) => {
        out[index] = { ...item, isDrawing: await detect(item) };
      }),
    );
  }
  return out;
}
