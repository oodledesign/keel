import type { CanvasItemData } from './canvas-types';

const MAX_URL = 2000;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function httpUrl(value: string | null | undefined): string | undefined {
  if (!value || value.length > MAX_URL) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** A lone web address in pasted or dropped text (no surrounding words). */
export function canvasUrlFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return httpUrl(trimmed) ?? null;
  if (/^www\.[^.]+\.\S+$/i.test(trimmed)) {
    return httpUrl(`https://${trimmed}`) ?? null;
  }
  return null;
}

/** Direct links to image files become image cards rather than link cards. */
export function isCanvasImageUrl(url: string): boolean {
  try {
    return IMAGE_EXTENSION.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Page preview trimmed to what a canvas card stores. */
export function linkCardPreview(meta: {
  title?: string | null;
  description?: string | null;
  faviconUrl?: string | null;
  ogImageUrl?: string | null;
}): Pick<CanvasItemData, 'title' | 'description' | 'faviconUrl' | 'imageUrl'> {
  const title = meta.title?.replace(/\s+/g, ' ').trim().slice(0, 500);
  const description = meta.description
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
  return {
    title: title || undefined,
    description: description || undefined,
    faviconUrl: httpUrl(meta.faviconUrl),
    imageUrl: httpUrl(meta.ogImageUrl),
  };
}
