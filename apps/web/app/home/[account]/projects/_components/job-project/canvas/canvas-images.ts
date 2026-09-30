'use client';

import { useEffect, useState } from 'react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export const CANVAS_IMAGE_BUCKET = 'project-canvas';
export const CANVAS_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const CANVAS_IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(',');

export function canvasImageExtension(file: File): string | null {
  return IMAGE_EXTENSIONS[file.type] ?? null;
}

const MAX_PLACED_SIDE = 480;
const FALLBACK_SIZE = { w: 280, h: 200 };

/** Natural size scaled down so a dropped screenshot doesn't fill the canvas. */
export async function placedImageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (!width || !height) return FALLBACK_SIZE;
    const scale = Math.min(1, MAX_PLACED_SIDE / Math.max(width, height));
    return {
      w: Math.max(40, Math.round(width * scale)),
      h: Math.max(40, Math.round(height * scale)),
    };
  } catch {
    return FALLBACK_SIZE;
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const signedUrls = new Map<string, { url: string; expiresAt: number }>();

function cachedSignedUrl(path: string | undefined) {
  if (!path) return null;
  const hit = signedUrls.get(path);
  return hit && hit.expiresAt > Date.now() ? hit.url : null;
}

/** Signed URL for a private canvas image; shared across nodes and remounts. */
/** `undefined` while signing, `null` if the image can't be loaded. */
export function useCanvasImageUrl(path: string | undefined) {
  const supabase = useSupabase();
  const [url, setUrl] = useState<string | null | undefined>(() =>
    cachedSignedUrl(path),
  );

  useEffect(() => {
    if (!path || cachedSignedUrl(path)) return;
    let cancelled = false;
    void supabase.storage
      .from(CANVAS_IMAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (data?.signedUrl) {
          signedUrls.set(path, {
            url: data.signedUrl,
            expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
          });
        }
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, supabase]);

  return url;
}
