import { describe, expect, it } from 'vitest';

import {
  LISTING_IMAGE_MAX_LONG_EDGE,
  listingImageTargetDimensions,
  shouldCompressListingImage,
} from '../compress-listing-image';
import { encodeStorageSignedUrl } from '../listing-media-public-url';

describe('listingImageTargetDimensions', () => {
  it('leaves images within the long-edge cap unchanged', () => {
    expect(listingImageTargetDimensions(1600, 1200)).toEqual({
      width: 1600,
      height: 1200,
      scaled: false,
    });
  });

  it('scales iPhone-sized JPEGs down to the long-edge cap', () => {
    expect(listingImageTargetDimensions(4032, 3024)).toEqual({
      width: LISTING_IMAGE_MAX_LONG_EDGE,
      height: 1800,
      scaled: true,
    });
  });

  it('scales portrait images by height', () => {
    expect(listingImageTargetDimensions(3024, 4032)).toEqual({
      width: 1800,
      height: LISTING_IMAGE_MAX_LONG_EDGE,
      scaled: true,
    });
  });
});

describe('shouldCompressListingImage', () => {
  it('skips small images and gifs', () => {
    expect(
      shouldCompressListingImage({ type: 'image/jpeg', size: 100_000 }),
    ).toBe(false);
    expect(
      shouldCompressListingImage({ type: 'image/gif', size: 2_000_000 }),
    ).toBe(false);
  });

  it('compresses large jpegs', () => {
    expect(
      shouldCompressListingImage({ type: 'image/jpeg', size: 3_600_000 }),
    ).toBe(true);
  });
});

describe('encodeStorageSignedUrl', () => {
  it('percent-encodes spaces in storage object paths', () => {
    const input =
      'https://example.supabase.co/storage/v1/object/sign/commercial-listing-media/acc/listing/uuid-IMG_8331 Main Photo.JPG?token=abc';
    const encoded = encodeStorageSignedUrl(input);
    expect(encoded).toContain('IMG_8331%20Main%20Photo.JPG');
    expect(encoded).not.toContain('Main Photo');
    expect(encoded).toContain('token=abc');
  });

  it('does not double-encode already escaped paths', () => {
    const input =
      'https://example.supabase.co/storage/v1/object/sign/bucket/path/IMG_8331%20Main.jpg?token=abc';
    expect(encodeStorageSignedUrl(input)).toBe(input);
  });
});
