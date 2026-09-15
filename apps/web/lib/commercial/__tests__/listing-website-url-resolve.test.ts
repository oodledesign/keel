import { describe, expect, it } from 'vitest';

import {
  listingWebsiteSlugCandidates,
  lookupWordpressListingPageUrl,
  pickConfidentWordpressMatch,
  resolvePublicWebsiteSiteOrigin,
} from '../listing-website-url-resolve';

const listing = {
  externalId: '73895ca3',
  addressLine1: '20-21 Chapman Way',
  addressLine2: null,
  town: 'Tunbridge Wells',
  name: 'Chapman Way',
};

describe('listingWebsiteSlugCandidates', () => {
  it('includes the full address slug first', () => {
    expect(listingWebsiteSlugCandidates(listing)[0]).toBe(
      '20-21-chapman-way-tunbridge-wells',
    );
  });
});

describe('pickConfidentWordpressMatch', () => {
  it('returns a unique high-confidence slug match', () => {
    const match = pickConfidentWordpressMatch(
      [
        {
          id: 1,
          slug: '20-21-chapman-way-tunbridge-wells',
          link: 'https://www.bracketts.co.uk/property/20-21-chapman-way-tunbridge-wells/',
          title: '20-21 Chapman Way, Tunbridge Wells',
        },
      ],
      listing,
    );
    expect(match?.slug).toBe('20-21-chapman-way-tunbridge-wells');
  });

  it('returns null when two listings score similarly', () => {
    const match = pickConfidentWordpressMatch(
      [
        {
          id: 1,
          slug: '20-chapman-way-tunbridge-wells',
          link: 'https://www.bracketts.co.uk/property/20-chapman-way-tunbridge-wells/',
          title: '20 Chapman Way, Tunbridge Wells',
        },
        {
          id: 2,
          slug: '21-chapman-way-tunbridge-wells',
          link: 'https://www.bracketts.co.uk/property/21-chapman-way-tunbridge-wells/',
          title: '21 Chapman Way, Tunbridge Wells',
        },
      ],
      listing,
    );
    expect(match).toBeNull();
  });
});

describe('resolvePublicWebsiteSiteOrigin', () => {
  it('reads the origin from a listing URL template', () => {
    expect(
      resolvePublicWebsiteSiteOrigin({
        listingUrlTemplate: 'https://www.bracketts.co.uk/property/{slug}/',
      }),
    ).toBe('https://www.bracketts.co.uk');
  });
});

describe('lookupWordpressListingPageUrl', () => {
  it('returns the WP link when a slug candidate matches', async () => {
    const url = await lookupWordpressListingPageUrl({
      siteOrigin: 'https://www.bracketts.co.uk',
      listing,
      deps: {
        fetch: async (input) => {
          const href = String(input);
          if (href.includes('slug=20-21-chapman-way-tunbridge-wells')) {
            return Response.json([
              {
                id: 99,
                slug: '20-21-chapman-way-tunbridge-wells',
                link: 'https://www.bracketts.co.uk/property/20-21-chapman-way-tunbridge-wells/',
                title: { rendered: '20-21 Chapman Way, Tunbridge Wells' },
              },
            ]);
          }
          return Response.json([]);
        },
      },
    });
    expect(url).toBe(
      'https://www.bracketts.co.uk/property/20-21-chapman-way-tunbridge-wells/',
    );
  });
});
