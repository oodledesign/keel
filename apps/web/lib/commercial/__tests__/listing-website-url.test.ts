import { describe, expect, it } from 'vitest';

import {
  applyListingWebsiteUrlTemplate,
  buildListingAddressSlug,
  isCommercialFeedUrl,
  isPublicListingPageUrl,
  resolveStoredOrTemplatedWebsiteUrl,
  slugifyListingSegment,
} from '../listing-website-url';

describe('slugifyListingSegment', () => {
  it('slugifies like WordPress paths', () => {
    expect(slugifyListingSegment('80 Camden Road')).toBe('80-camden-road');
    expect(slugifyListingSegment('141 & 151 London Road')).toBe(
      '141-and-151-london-road',
    );
  });
});

describe('buildListingAddressSlug', () => {
  it('joins address line1, line2, town', () => {
    expect(
      buildListingAddressSlug({
        addressLine1: 'Lonsdale Gate',
        addressLine2: 'Lonsdale Gardens',
        town: 'Tunbridge Wells',
      }),
    ).toBe('lonsdale-gate-lonsdale-gardens-tunbridge-wells');
  });
});

describe('applyListingWebsiteUrlTemplate', () => {
  const listing = {
    externalId: '119390',
    addressLine1: '4 London Road',
    addressLine2: null,
    town: 'Crowborough',
    postcode: 'TN6 2TT',
  };

  it('fills {slug} for Bracketts-style templates', () => {
    expect(
      applyListingWebsiteUrlTemplate(
        'https://www.bracketts.co.uk/property/{slug}/',
        listing,
      ),
    ).toBe('https://www.bracketts.co.uk/property/4-london-road-crowborough/');
  });

  it('fills {external_id} when present', () => {
    expect(
      applyListingWebsiteUrlTemplate(
        'https://example.com/p/{external_id}',
        listing,
      ),
    ).toBe('https://example.com/p/119390');
  });

  it('returns null when a used placeholder is empty', () => {
    expect(
      applyListingWebsiteUrlTemplate('https://example.com/p/{external_id}', {
        ...listing,
        externalId: null,
      }),
    ).toBeNull();
  });
});

describe('isCommercialFeedUrl / isPublicListingPageUrl', () => {
  it('rejects Ozer XML feed URLs as listing pages', () => {
    const feed =
      'https://app.ozer.so/api/commercial/property-hive-feed?token=abc';
    expect(isCommercialFeedUrl(feed)).toBe(true);
    expect(isPublicListingPageUrl(feed)).toBe(false);
    expect(
      isPublicListingPageUrl(
        'https://www.bracketts.co.uk/property/80-camden-road-tunbridge-wells/',
      ),
    ).toBe(true);
  });
});

describe('resolveStoredOrTemplatedWebsiteUrl', () => {
  const listing = {
    externalId: '390432',
    addressLine1: '80 Camden Road',
    town: 'Tunbridge Wells',
  };

  it('prefers stored website_url', () => {
    expect(
      resolveStoredOrTemplatedWebsiteUrl({
        websiteUrl: 'https://www.bracketts.co.uk/property/manual/',
        portalExternalUrl: 'https://www.bracketts.co.uk/property/from-portal/',
        template: 'https://www.bracketts.co.uk/property/{slug}/',
        listing,
      }),
    ).toBe('https://www.bracketts.co.uk/property/manual/');
  });

  it('skips feed portal URLs and uses template', () => {
    expect(
      resolveStoredOrTemplatedWebsiteUrl({
        websiteUrl: null,
        portalExternalUrl:
          'https://app.ozer.so/api/commercial/property-hive-feed?token=x',
        template: 'https://www.bracketts.co.uk/property/{slug}/',
        listing,
      }),
    ).toBe(
      'https://www.bracketts.co.uk/property/80-camden-road-tunbridge-wells/',
    );
  });
});
