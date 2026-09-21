import { describe, expect, it } from 'vitest';

import {
  LISTING_MEDIA_LIST_TRANSFORM,
  LISTING_MEDIA_PREVIEW_TRANSFORM,
  RIGHTMOVE_MEDIA_URL_MAX_LENGTH,
  buildCommercialListingMediaPublicUrl,
  commercialListingMediaFileName,
  commercialListingMediaVersion,
  listingMediaSignedUrlTransform,
  listingMediaTransformFor,
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

describe('listingMediaTransformFor', () => {
  it('uses the small list transform for card/list covers', () => {
    expect(listingMediaTransformFor('list')).toEqual(
      LISTING_MEDIA_LIST_TRANSFORM,
    );
    expect(LISTING_MEDIA_LIST_TRANSFORM.width).toBeLessThanOrEqual(400);
    expect(LISTING_MEDIA_LIST_TRANSFORM.height).toBeLessThanOrEqual(400);
    expect(LISTING_MEDIA_LIST_TRANSFORM.quality).toBe(70);
  });

  it('keeps the large gallery transform for detail previews', () => {
    expect(listingMediaTransformFor('gallery')).toEqual(
      LISTING_MEDIA_PREVIEW_TRANSFORM,
    );
    expect(LISTING_MEDIA_PREVIEW_TRANSFORM.width).toBe(1600);
    expect(LISTING_MEDIA_PREVIEW_TRANSFORM.height).toBe(1600);
  });
});

describe('listingMediaSignedUrlTransform', () => {
  it('returns the list size for jpeg covers and skips non-images', () => {
    expect(listingMediaSignedUrlTransform('image/jpeg', 'list')).toEqual(
      LISTING_MEDIA_LIST_TRANSFORM,
    );
    expect(listingMediaSignedUrlTransform('image/png', 'gallery')).toEqual(
      LISTING_MEDIA_PREVIEW_TRANSFORM,
    );
    expect(
      listingMediaSignedUrlTransform('application/pdf', 'list'),
    ).toBeUndefined();
    expect(listingMediaSignedUrlTransform(null, 'gallery')).toBeUndefined();
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
