import { describe, expect, it } from 'vitest';

import {
  LISTING_MEDIA_DERIVATIVES,
  RIGHTMOVE_MEDIA_URL_MAX_LENGTH,
  buildCommercialListingMediaPublicUrl,
  commercialListingMediaFileName,
  commercialListingMediaVersion,
  listingMediaDerivativePath,
  listingMediaDisplayPath,
  listingMediaSupportsDerivatives,
  pickListingCoverMedia,
  withRightmoveMediaCacheBust,
} from '../listing-media-public-url';

describe('commercialListingMediaFileName', () => {
  it('forces brochure filenames to end with .pdf', () => {
    expect(
      commercialListingMediaFileName({
        mediaType: 'brochure',
        fileName: 'Unit brochure.PDF',
        mimeType: 'application/pdf',
      }),
    ).toBe('brochure.pdf');
  });
});

describe('buildCommercialListingMediaPublicUrl', () => {
  it('stays under Rightmove media url max length', () => {
    const url = buildCommercialListingMediaPublicUrl({
      siteUrl: 'https://app.ozer.so',
      mediaId: '702cafa5-a1bf-4a80-b7be-f498fbc52f33',
      mediaType: 'brochure',
      fileName: 'A very long brochure name that should not matter.pdf',
      mimeType: 'application/pdf',
    });
    expect(url).toBe(
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.pdf',
    );
    expect(url.length).toBeLessThanOrEqual(RIGHTMOVE_MEDIA_URL_MAX_LENGTH);
    expect(url.endsWith('.pdf')).toBe(true);
  });
});

describe('withRightmoveMediaCacheBust', () => {
  it('embeds hyphenated bust so brochure URLs still end in .pdf', () => {
    const busted = withRightmoveMediaCacheBust(
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.pdf',
      1787230000,
    );
    expect(busted).toBe(
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure-v1787230000.pdf',
    );
    expect(busted.endsWith('.pdf')).toBe(true);
    expect(new URL(busted).search).toBe('');
    expect(busted.length).toBeLessThanOrEqual(RIGHTMOVE_MEDIA_URL_MAX_LENGTH);
  });

  it('leaves signed URLs with query strings unchanged', () => {
    const signed =
      'https://example.supabase.co/storage/v1/object/sign/path/file.jpg?token=abc';
    expect(withRightmoveMediaCacheBust(signed, 1787230000)).toBe(signed);
  });
});

describe('listingMediaDerivativePath', () => {
  it('stores copies next to the original', () => {
    expect(
      listingMediaDerivativePath('acct/listing/uuid-main.png', 'thumb'),
    ).toBe('acct/listing/uuid-main.png.thumb.jpg');
    expect(
      listingMediaDerivativePath('acct/listing/uuid-main.png', 'preview'),
    ).toBe('acct/listing/uuid-main.png.preview.jpg');
  });

  it('keeps thumbs smaller than previews', () => {
    expect(LISTING_MEDIA_DERIVATIVES.thumb.maxLongEdge).toBeLessThan(
      LISTING_MEDIA_DERIVATIVES.preview.maxLongEdge,
    );
  });
});

describe('listingMediaDisplayPath', () => {
  const full = {
    storagePath: 'a/b/original.jpg',
    thumbPath: 'a/b/original.jpg.thumb.jpg',
    previewPath: 'a/b/original.jpg.preview.jpg',
  };

  it('uses the thumb for lists and the preview for galleries', () => {
    expect(listingMediaDisplayPath(full, 'list')).toBe(full.thumbPath);
    expect(listingMediaDisplayPath(full, 'gallery')).toBe(full.previewPath);
  });

  it('falls back to the original when copies are missing', () => {
    const bare = { storagePath: 'a/b/original.jpg' };
    expect(listingMediaDisplayPath(bare, 'list')).toBe(bare.storagePath);
    expect(listingMediaDisplayPath(bare, 'gallery')).toBe(bare.storagePath);
    expect(
      listingMediaDisplayPath(
        { ...bare, previewPath: full.previewPath },
        'list',
      ),
    ).toBe(full.previewPath);
  });

  it('returns null for external-only media', () => {
    expect(listingMediaDisplayPath({ storagePath: null }, 'list')).toBeNull();
  });
});

describe('listingMediaSupportsDerivatives', () => {
  it('covers photos and skips gifs and documents', () => {
    expect(listingMediaSupportsDerivatives('image/jpeg')).toBe(true);
    expect(listingMediaSupportsDerivatives('image/png')).toBe(true);
    expect(listingMediaSupportsDerivatives('image/gif')).toBe(false);
    expect(listingMediaSupportsDerivatives('application/pdf')).toBe(false);
    expect(listingMediaSupportsDerivatives(null)).toBe(false);
  });
});

describe('pickListingCoverMedia', () => {
  it('prefers is_cover over the first image in sort order', () => {
    const picked = pickListingCoverMedia([
      { listingId: 'a', isCover: false, id: 'first' },
      { listingId: 'a', isCover: true, id: 'cover' },
      { listingId: 'b', isCover: false, id: 'only' },
    ]);
    expect(picked.get('a')?.id).toBe('cover');
    expect(picked.get('b')?.id).toBe('only');
  });
});

describe('commercialListingMediaVersion', () => {
  it('changes when the stored file path changes on the same media id', () => {
    const mediaId = '702cafa5-a1bf-4a80-b7be-f498fbc52f33';
    const before = commercialListingMediaVersion({
      mediaId,
      storagePath: 'acct/listing/old-uuid-main.jpg',
      createdAt: '2026-08-07T10:00:00.000Z',
    });
    const after = commercialListingMediaVersion({
      mediaId,
      storagePath: 'acct/listing/new-uuid-main.jpg',
      createdAt: '2026-08-07T10:00:00.000Z',
    });
    expect(before).not.toBe(after);
    expect(after).toContain('new-uuid-main');
  });
});
