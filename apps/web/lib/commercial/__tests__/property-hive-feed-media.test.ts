import { describe, expect, it } from 'vitest';

import { buildCommercialListingMediaPublicUrl } from '../listing-media-public-url';

describe('Property Hive feed media URLs', () => {
  it('uses short stable proxy URLs suitable for portal import', () => {
    const url = buildCommercialListingMediaPublicUrl({
      siteUrl: 'https://app.ozer.so',
      mediaId: '93da9b73-2ae6-4400-98f4-86c76164490e',
      mediaType: 'image',
      fileName: 'hero.jpg',
      mimeType: 'image/jpeg',
    });

    expect(url).toBe(
      'https://app.ozer.so/api/commercial/listing-media/93da9b73-2ae6-4400-98f4-86c76164490e/file.jpg',
    );
    expect(url.length).toBeLessThan(250);
    expect(url).not.toContain('supabase.co');
  });
});
