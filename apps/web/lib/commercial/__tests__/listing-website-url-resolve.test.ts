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
  it('prefers a numeric external_id as the WP property post id', async () => {
    const url = await lookupWordpressListingPageUrl({
      siteOrigin: 'https://www.bracketts.co.uk',
      listing: { ...listing, externalId: '72803' },
      deps: {
        fetch: async (input) => {
          const href = String(input);
          if (href.includes('/wp-json/wp/v2/property/72803')) {
            return Response.json({
              id: 72803,
              slug: 'high-street-tonbridge-tn9-9',
              link: 'https://www.bracketts.co.uk/property/high-street-tonbridge-tn9-9/',
              title: { rendered: 'High Street, Tonbridge, TN9' },
            });
          }
          throw new Error(`unexpected fetch ${href}`);
        },
      },
    });
    expect(url).toBe(
      'https://www.bracketts.co.uk/property/high-street-tonbridge-tn9-9/',
    );
  });

  it('falls through to slug search when the numeric post id is missing', async () => {
    const requested: string[] = [];
    const url = await lookupWordpressListingPageUrl({
      siteOrigin: 'https://www.bracketts.co.uk',
      listing: { ...listing, externalId: '72803' },
      deps: {
        fetch: async (input) => {
          const href = String(input);
          requested.push(href);
          if (href.includes('/wp-json/wp/v2/property/72803')) {
            return new Response('Not Found', { status: 404 });
          }
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
    expect(requested[0]).toContain('/wp-json/wp/v2/property/72803');
    expect(url).toBe(
      'https://www.bracketts.co.uk/property/20-21-chapman-way-tunbridge-wells/',
    );
  });

  it('does not fetch when DNS resolves to a private address', async () => {
    let fetched = false;
    const url = await lookupWordpressListingPageUrl({
      siteOrigin: 'https://www.bracketts.co.uk',
      listing: { ...listing, externalId: '72803' },
      deps: {
        resolveHost: async () => ['127.0.0.1'],
        fetch: async () => {
          fetched = true;
          throw new Error('fetch should not run');
        },
      },
    });
    expect(fetched).toBe(false);
    expect(url).toBeNull();
  });

  it('uses title search when slug candidates miss', async () => {
    const url = await lookupWordpressListingPageUrl({
      siteOrigin: 'https://www.bracketts.co.uk',
      listing,
      deps: {
        fetch: async (input) => {
          const href = String(input);
          if (href.includes('search=20-21%20Chapman%20Way')) {
            return Response.json([
              {
                id: 42,
                slug: 'chapman-way-industrial-tunbridge-wells',
                link: 'https://www.bracketts.co.uk/property/chapman-way-industrial-tunbridge-wells/',
                title: { rendered: '20-21 Chapman Way, Tunbridge Wells' },
              },
            ]);
          }
          return Response.json([]);
        },
      },
    });
    expect(url).toBe(
      'https://www.bracketts.co.uk/property/chapman-way-industrial-tunbridge-wells/',
    );
  });

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
