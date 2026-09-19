import { describe, expect, it } from 'vitest';

import { parseRecipeImageDataUrl } from './fetch-recipe-image';
import { RECIPE_IMAGE_MAX_OUTPUT_BYTES } from './recipe-image-limits';

function jpegDataUrl(byteLength: number): string {
  const bytes = Buffer.alloc(byteLength, 0x41);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

describe('parseRecipeImageDataUrl', () => {
  it('accepts a small JPEG data URL', () => {
    const parsed = parseRecipeImageDataUrl(jpegDataUrl(64));
    expect(parsed?.contentType).toBe('image/jpeg');
    expect(parsed?.bytes.byteLength).toBe(64);
  });

  it('rejects HEIC data URLs', () => {
    expect(parseRecipeImageDataUrl('data:image/heic;base64,AAAA')).toBeNull();
  });

  it('rejects payloads over the post-compression ceiling', () => {
    expect(
      parseRecipeImageDataUrl(jpegDataUrl(RECIPE_IMAGE_MAX_OUTPUT_BYTES + 1)),
    ).toBeNull();
  });
});
