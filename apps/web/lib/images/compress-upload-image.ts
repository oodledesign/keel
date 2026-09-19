/**
 * Client-side image compression before upload.
 * Same idea as listing photos and iOS survey/disposal uploads:
 * accept a large phone original, then resize + JPEG-encode so the
 * request body stays under server / Vercel limits.
 */

export const UPLOAD_IMAGE_MAX_LONG_EDGE = 2048;
export const UPLOAD_IMAGE_JPEG_QUALITY = 0.82;
export const UPLOAD_IMAGE_MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const UPLOAD_IMAGE_MAX_OUTPUT_BYTES = 1_500_000;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
]);

export type CompressUploadImageCode =
  | 'too_large'
  | 'unsupported'
  | 'unreadable';

export class CompressUploadImageError extends Error {
  readonly code: CompressUploadImageCode;

  constructor(code: CompressUploadImageCode, message: string) {
    super(message);
    this.name = 'CompressUploadImageError';
    this.code = code;
  }
}

export function uploadImageTargetDimensions(
  width: number,
  height: number,
  maxLongEdge: number = UPLOAD_IMAGE_MAX_LONG_EDGE,
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

export function fileExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function isHeicLikeFile(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export function isAllowedUploadImage(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml') return false;
  if (ALLOWED_TYPES.has(type)) return true;
  if (type) return false;
  return ALLOWED_EXTENSIONS.has(fileExtension(file.name || ''));
}

export function formatUploadMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}` : mb.toFixed(1);
}

export function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image'));
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function unreadableMessage(heic: boolean): string {
  return heic
    ? 'Could not read that iPhone photo. Try Safari, or save it as JPEG/PNG and upload again.'
    : 'Could not read that image. Try a screenshot or a JPEG/PNG.';
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

async function renderJpegBlob(
  image: HTMLImageElement,
  width: number,
  height: number,
  qualities: number[],
  maxOutputBytes: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new CompressUploadImageError(
      'unreadable',
      'Could not prepare that photo in this browser.',
    );
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let last: Blob | null = null;
  for (const quality of qualities) {
    last = await canvasToJpegBlob(canvas, quality);
    if (last.size <= maxOutputBytes) return last;
  }

  if (!last) {
    throw new CompressUploadImageError(
      'unreadable',
      'Could not compress that photo.',
    );
  }

  return last;
}

export type CompressUploadImageOptions = {
  maxOriginalBytes?: number;
  maxOutputBytes?: number;
  maxLongEdge?: number;
  quality?: number;
};

/**
 * Resize the long edge and re-encode as JPEG. HEIC/HEIF is always converted.
 * Throws {@link CompressUploadImageError} with a user-facing message.
 */
export async function compressUploadImageFile(
  file: File,
  options?: CompressUploadImageOptions,
): Promise<File> {
  const maxOriginalBytes =
    options?.maxOriginalBytes ?? UPLOAD_IMAGE_MAX_ORIGINAL_BYTES;
  const maxOutputBytes =
    options?.maxOutputBytes ?? UPLOAD_IMAGE_MAX_OUTPUT_BYTES;
  const maxLongEdge = options?.maxLongEdge ?? UPLOAD_IMAGE_MAX_LONG_EDGE;
  const quality = options?.quality ?? UPLOAD_IMAGE_JPEG_QUALITY;
  const qualities = [quality, 0.72, 0.6].filter(
    (value, index, all) => all.indexOf(value) === index,
  );
  const heic = isHeicLikeFile(file);

  if (!file.size) {
    throw new CompressUploadImageError(
      'unreadable',
      'That photo looks empty — please choose another.',
    );
  }

  if (file.size > maxOriginalBytes) {
    throw new CompressUploadImageError(
      'too_large',
      `That photo is larger than ${formatUploadMegabytes(maxOriginalBytes)} MB. Choose a smaller photo or screenshot.`,
    );
  }

  if (!isAllowedUploadImage(file)) {
    throw new CompressUploadImageError(
      'unsupported',
      'Please choose a photo or screenshot (JPEG, PNG, WebP, GIF, or HEIC).',
    );
  }

  if (typeof document === 'undefined') {
    throw new CompressUploadImageError(
      'unreadable',
      'Could not prepare that photo in this environment.',
    );
  }

  try {
    const image = await loadImageElement(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const target = uploadImageTargetDimensions(
      sourceWidth,
      sourceHeight,
      maxLongEdge,
    );

    if (!target.width || !target.height) {
      throw new CompressUploadImageError('unreadable', unreadableMessage(heic));
    }

    const type = (file.type || '').toLowerCase();
    const alreadyJpeg = type === 'image/jpeg' || type === 'image/jpg';
    const canKeepOriginal =
      !heic && !target.scaled && file.size <= maxOutputBytes && alreadyJpeg;

    if (canKeepOriginal) {
      return file;
    }

    // Small PNG/WebP/GIF already under the send cap — keep original encoding.
    if (
      !heic &&
      !target.scaled &&
      file.size <= maxOutputBytes &&
      (type === 'image/png' || type === 'image/webp' || type === 'image/gif')
    ) {
      return file;
    }

    let blob = await renderJpegBlob(
      image,
      target.width,
      target.height,
      qualities,
      maxOutputBytes,
    );

    if (blob.size > maxOutputBytes) {
      const retry = uploadImageTargetDimensions(
        sourceWidth,
        sourceHeight,
        1600,
      );
      blob = await renderJpegBlob(
        image,
        retry.width,
        retry.height,
        [0.72, 0.6, 0.5],
        maxOutputBytes,
      );
    }

    if (blob.size > maxOutputBytes) {
      throw new CompressUploadImageError(
        'too_large',
        'That photo is still too large after compression. Try a tighter crop or a different screenshot.',
      );
    }

    return new File([blob], jpegFileName(file.name), { type: 'image/jpeg' });
  } catch (error) {
    if (error instanceof CompressUploadImageError) throw error;
    throw new CompressUploadImageError('unreadable', unreadableMessage(heic));
  }
}
