/**
 * Client-side listing photo compression before upload.
 * Keeps portal/gallery payloads reasonable without a separate original store.
 */

export const LISTING_IMAGE_MAX_LONG_EDGE = 2400;
export const LISTING_IMAGE_JPEG_QUALITY = 0.8;
/** Skip canvas work when the file is already small enough. */
export const LISTING_IMAGE_COMPRESS_MIN_BYTES = 400 * 1024;

export function listingImageTargetDimensions(
  width: number,
  height: number,
  maxLongEdge: number = LISTING_IMAGE_MAX_LONG_EDGE,
): { width: number; height: number; scaled: boolean } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 0, height: 0, scaled: false };
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      scaled: false,
    };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

export function shouldCompressListingImage(file: {
  type: string;
  size: number;
}): boolean {
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return false;
  if (type === 'image/gif' || type === 'image/svg+xml') return false;
  return file.size >= LISTING_IMAGE_COMPRESS_MIN_BYTES;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image for compression'));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compress image'));
      },
      'image/jpeg',
      quality,
    );
  });
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Resize long edge and re-encode as JPEG ~0.8. Returns the original file when
 * compression is unnecessary or fails (caller can still upload original).
 */
export async function compressListingImageFile(
  file: File,
  options?: {
    maxLongEdge?: number;
    quality?: number;
  },
): Promise<File> {
  if (typeof document === 'undefined') return file;
  if (!shouldCompressListingImage(file)) return file;

  try {
    const image = await loadImageElement(file);
    const target = listingImageTargetDimensions(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      options?.maxLongEdge ?? LISTING_IMAGE_MAX_LONG_EDGE,
    );

    if (!target.width || !target.height) return file;

    // Already within bounds and not huge — keep original encoding.
    if (!target.scaled && file.size < 1.5 * 1024 * 1024) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(image, 0, 0, target.width, target.height);

    const blob = await canvasToJpegBlob(
      canvas,
      options?.quality ?? LISTING_IMAGE_JPEG_QUALITY,
    );

    // Prefer compressed only when it actually helps.
    if (blob.size >= file.size * 0.98 && !target.scaled) {
      return file;
    }

    return new File([blob], jpegFileName(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
