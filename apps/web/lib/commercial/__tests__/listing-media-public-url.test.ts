import { describe, expect, it } from 'vitest';

import {
  RIGHTMOVE_MEDIA_URL_MAX_LENGTH,
  buildCommercialListingMediaPublicUrl,
  commercialListingMediaFileName,
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
  it('embeds bust before extension so brochure URLs still end in .pdf', () => {
    const busted = withRightmoveMediaCacheBust(
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.pdf',
      1787230000,
    );
    expect(busted).toBe(
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.v1787230000.pdf',
    );
    expect(busted.endsWith('.pdf')).toBe(true);
    expect(new URL(busted).search).toBe('');
    expect(busted.length).toBeLessThanOrEqual(RIGHTMOVE_MEDIA_URL_MAX_LENGTH);
  });
});
