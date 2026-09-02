import { describe, expect, it } from 'vitest';

import {
  isSafeHttpUrl,
  linkedInPermalinkFromUrn,
  resolveListingPublicUrl,
} from './listing-public-url';

describe('resolveListingPublicUrl', () => {
  it('prefers the listing website URL over portals and brochure share', () => {
    const result = resolveListingPublicUrl({
      websiteUrl: 'https://www.bracketts.co.uk/property/unit-9',
      brochureShareEnabled: true,
      brochureShareToken: 'a'.repeat(24),
      publications: [
        {
          portal: 'each',
          status: 'published',
          externalUrl: 'https://www.each.co.uk/property/123',
        },
      ],
      appOrigin: 'https://app.ozer.so',
    });

    expect(result).toEqual({
      url: 'https://www.bracketts.co.uk/property/unit-9',
      source: 'website',
      label: 'Website listing',
    });
  });

  it('uses a live Property Hive URL when no website URL is set', () => {
    const result = resolveListingPublicUrl({
      websiteUrl: null,
      brochureShareEnabled: true,
      brochureShareToken: 'a'.repeat(24),
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          externalUrl: 'https://www.rightmove.co.uk/properties/1',
        },
        {
          portal: 'property_hive',
          status: 'live',
          externalUrl: 'https://www.bracketts.co.uk/property/hive-1',
        },
      ],
      appOrigin: 'https://app.ozer.so',
    });

    expect(result.source).toBe('portal');
    expect(result.url).toBe('https://www.bracketts.co.uk/property/hive-1');
    expect(result.label).toBe('Property Hive listing');
  });

  it('falls back to the Ozer brochure share on the real app origin', () => {
    const result = resolveListingPublicUrl({
      websiteUrl: 'not-a-url',
      brochureShareEnabled: true,
      brochureShareToken: 'brochuretoken12345678',
      publications: [],
      appOrigin: 'https://app.ozer.so',
    });

    expect(result).toEqual({
      url: 'https://app.ozer.so/share/brochure/brochuretoken12345678',
      source: 'brochure',
      label: 'Ozer brochure share',
    });
  });

  it('returns null when no real public URL exists', () => {
    const result = resolveListingPublicUrl({
      websiteUrl: null,
      brochureShareEnabled: false,
      brochureShareToken: null,
      publications: [
        {
          portal: 'each',
          status: 'draft',
          externalUrl: 'https://www.each.co.uk/property/hidden',
        },
      ],
      appOrigin: 'https://app.ozer.so',
    });

    expect(result).toEqual({ url: null, source: null, label: null });
  });

  it('does not invent a domain from a relative or empty origin', () => {
    expect(
      resolveListingPublicUrl({
        websiteUrl: '/property/1',
        brochureShareEnabled: true,
        brochureShareToken: 'token',
        appOrigin: '',
      }).url,
    ).toBeNull();
  });
});

describe('isSafeHttpUrl', () => {
  it('accepts http(s) only', () => {
    expect(isSafeHttpUrl('https://app.ozer.so/share/brochure/x')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('linkedInPermalinkFromUrn', () => {
  it('builds a feed permalink from a share URN', () => {
    expect(linkedInPermalinkFromUrn('urn:li:share:123')).toBe(
      'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123',
    );
  });
});
