import { describe, expect, it } from 'vitest';

import {
  buildStoragePath,
  extensionFromMime,
  extensionFromUrlOrName,
  resolveCommercialMediaPublicUrl,
  safeMediaFileName,
} from '../migrate-external-listing-media';

describe('resolveCommercialMediaPublicUrl', () => {
  it('prefers storage signed URL over external AS hosts', () => {
    expect(
      resolveCommercialMediaPublicUrl({
        storageSignedUrl: 'https://supabase.example/signed.jpg',
        externalUrl: 'https://as-images.imgix.net/abc.jpg',
      }),
    ).toBe('https://supabase.example/signed.jpg');
  });

  it('falls back to external when storage is missing', () => {
    expect(
      resolveCommercialMediaPublicUrl({
        storageSignedUrl: null,
        externalUrl: 'https://as-images.imgix.net/abc.jpg',
      }),
    ).toBe('https://as-images.imgix.net/abc.jpg');
  });
});

describe('media path helpers', () => {
  it('sanitizes file names and builds account/listing paths', () => {
    expect(safeMediaFileName('../a/b.jpg')).toBe('__a_b.jpg');
    expect(
      buildStoragePath({
        accountId: 'acc',
        listingId: 'list',
        fileName: 'photo.jpg',
        uuid: 'uuid',
      }),
    ).toBe('acc/list/uuid-photo.jpg');
  });

  it('infers extensions from mime and URLs', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(
      extensionFromUrlOrName(
        'https://as-images.imgix.net/efe925d2-img-4034.jpg?w=800',
      ),
    ).toBe('jpg');
  });
});
