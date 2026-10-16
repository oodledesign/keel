import 'server-only';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

import type { TypeSafeImageAsset } from '~/lib/ai/typesafe';

/** TypeSafe rejects images with a side over 1568px. */
export const JEV_IMAGE_MAX_EDGE = 1568;
/** TypeSafe rejects images with a side under 280px. */
export const JEV_IMAGE_MIN_EDGE = 280;

const JPEG_QUALITY = 85;

/**
 * Prepare a photo for Jev: EXIF-rotate, fit inside 1568×1568, ensure min edge,
 * baseline JPEG. Returns null if the buffer cannot be decoded.
 */
export async function prepareJevJpeg(
  bytes: Uint8Array | Buffer,
): Promise<{ buffer: Buffer; asset: TypeSafeImageAsset } | null> {
  try {
    const meta = await sharp(bytes, { failOn: 'none' }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < 1 || height < 1) return null;

    let buffer = await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({
        width: JEV_IMAGE_MAX_EDGE,
        height: JEV_IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const outMeta = await sharp(buffer).metadata();
    const outW = outMeta.width ?? 0;
    const outH = outMeta.height ?? 0;
    if (outW < JEV_IMAGE_MIN_EDGE || outH < JEV_IMAGE_MIN_EDGE) {
      // Pad small images up to the minimum rather than reject.
      buffer = await sharp(buffer)
        .extend({
          top: Math.max(0, Math.ceil((JEV_IMAGE_MIN_EDGE - outH) / 2)),
          bottom: Math.max(0, Math.floor((JEV_IMAGE_MIN_EDGE - outH) / 2)),
          left: Math.max(0, Math.ceil((JEV_IMAGE_MIN_EDGE - outW) / 2)),
          right: Math.max(0, Math.floor((JEV_IMAGE_MIN_EDGE - outW) / 2)),
          background: '#ffffff',
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    }

    return {
      buffer,
      asset: {
        type: 'image',
        format: 'jpg',
        data_base64: buffer.toString('base64'),
      },
    };
  } catch {
    return null;
  }
}

/** Fresh reference key that will not collide with prose mid-string. */
export function newJevImageRef(prefix = 'img'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export async function fetchBytesForJev(
  url: string,
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
