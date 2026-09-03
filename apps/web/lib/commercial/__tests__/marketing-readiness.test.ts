import { describe, expect, it } from 'vitest';

import { getMarketingReadiness } from '../marketing-readiness';

const emptyListing = {
  summary: null,
  keyPoints: [],
  epcBand: null,
  epcRating: null,
  websiteUrl: null,
  latitude: null,
  longitude: null,
  coverUrl: null,
  actingAgents: [],
};

describe('getMarketingReadiness hrefTab targets', () => {
  it('points acting agent at Management and website/portal at Publishing', () => {
    const readiness = getMarketingReadiness({ listing: emptyListing });
    const byId = Object.fromEntries(
      readiness.items.map((item) => [item.id, item]),
    );

    expect(byId.acting_agent?.hrefTab).toBe('management');
    expect(byId.acting_agent?.hint).toMatch(/Management/i);
    expect(byId.website_or_portal?.hrefTab).toBe('publishing');
    expect(byId.epc?.hrefTab).toBe('media');
    expect(byId.epc?.hint).toMatch(/Media/i);
  });

  it('keeps EPC as a checklist item, not a hard block', () => {
    const readiness = getMarketingReadiness({
      listing: {
        ...emptyListing,
        summary: 'Short summary for the listing.',
        keyPoints: ['One', 'Two', 'Three'],
        websiteUrl: 'https://example.com',
        latitude: 51.5,
        longitude: -0.1,
        coverUrl: 'https://example.com/cover.jpg',
        actingAgents: [{ id: 'agent' }],
        brochureShareEnabled: true,
      },
    });

    expect(readiness.items.find((item) => item.id === 'epc')?.pass).toBe(false);
    expect(readiness.ready).toBe(false);
    expect(readiness.passCount).toBe(readiness.total - 1);
  });
});
