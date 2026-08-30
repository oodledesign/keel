import 'server-only';

import { isPrivateOrLocalUrl } from '~/lib/ai/recipe-extract-utils';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 4_000_000;
const RECIPE_FETCH_UA = 'OzerRecipeBot/1.0 (+https://ozer.so; recipe-extract)';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function sniffContentType(header: string | null, bytes: Buffer): string | null {
  const declared = header?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (ALLOWED_TYPES.has(declared)) {
    return declared === 'image/jpg' ? 'image/jpeg' : declared;
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 6 && bytes.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'image/gif';
  }

  return null;
}

async function fetchOnce(url: string, redirect: RequestRedirect) {
  return fetch(url, {
    headers: {
      'User-Agent': RECIPE_FETCH_UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/**
 * Fetch a remote cover image with the same SSRF rules as recipe page fetch:
 * http(s) only, reject private/local hosts, one redirect hop re-checked.
 */
export async function fetchPublicRecipeImage(url: string): Promise<{
  bytes: Buffer;
  contentType: string;
} | null> {
  if (isPrivateOrLocalUrl(url)) return null;

  try {
    let response = await fetchOnce(url, 'manual');

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const redirectUrl = new URL(location, url).href;
      if (isPrivateOrLocalUrl(redirectUrl)) return null;
      response = await fetchOnce(redirectUrl, 'error');
    }

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const contentType = sniffContentType(
      response.headers.get('content-type'),
      buffer,
    );
    if (!contentType) return null;

    return { bytes: buffer, contentType };
  } catch {
    return null;
  }
}

export function parseRecipeImageDataUrl(payload: string): {
  bytes: Buffer;
  contentType: string;
} | null {
  const trimmed = payload.trim();
  const dataUrl = /^data:(image\/(?:jpeg|jpg|png|gif|webp));base64,(.+)$/i.exec(
    trimmed,
  );
  if (!dataUrl?.[1] || !dataUrl[2]) return null;

  const contentType =
    dataUrl[1].toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : dataUrl[1].toLowerCase();
  try {
    const bytes = Buffer.from(dataUrl[2].replace(/\s/g, ''), 'base64');
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}
