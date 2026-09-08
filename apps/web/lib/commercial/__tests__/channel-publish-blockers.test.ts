import { describe, expect, it } from 'vitest';

import { channelEnableCanContinue } from '../channel-enable-gate';
import { collectChannelPublishBlockers } from '../channel-publish-blockers';
import {
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
} from '../channel-publish-status';
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

describe('collectChannelPublishBlockers', () => {
  it('lists status plus remaining checklist items for a draft disposal', () => {
    const channel = getWebsiteChannelStatus({
      listing: { status: 'draft', externalId: null },
      publications: [{ portal: 'property_hive', status: 'unpublished' }],
    });
    const readiness = getMarketingReadiness({ listing: emptyListing });

    const blockers = collectChannelPublishBlockers({
      channel,
      readiness,
      accountSlug: 'bracketts',
      listingId: 'listing-1',
      listingStatus: 'draft',
    });

    expect(channel.canEnable).toBe(false);
    expect(blockers[0]?.id).toBe('status');
    expect(blockers[0]?.actionLabel).toBe('Edit status');
    expect(blockers[0]?.href).toBe('/app/bracketts/listings/listing-1/edit');
    expect(blockers[0]?.label).toMatch(/Draft/);
    expect(blockers.some((item) => item.id === 'readiness:epc')).toBe(true);
    expect(
      blockers.some((item) => item.id === 'readiness:website_or_portal'),
    ).toBe(true);
    expect(blockers.find((item) => item.id === 'readiness:epc')?.href).toBe(
      '/app/bracketts/listings/listing-1/media',
    );
  });

  it('returns no required blockers when the channel can be enabled', () => {
    const channel = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '1' },
      publications: [{ portal: 'property_hive', status: 'unpublished' }],
    });
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
        epcBand: 'B',
      },
    });

    const blockers = collectChannelPublishBlockers({
      channel,
      readiness,
      accountSlug: 'bracketts',
      listingId: 'listing-1',
      listingStatus: 'marketing',
    });

    expect(channel.canEnable).toBe(true);
    expect(blockers).toEqual([]);
  });

  it('maps Rightmove address blockers to Edit', () => {
    const channel = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        name: 'Venue Draft',
        postcode: 'TN9 1AB',
        addressLine1: null,
      },
      publications: [],
    });
    const blockers = collectChannelPublishBlockers({
      channel,
      readiness: getMarketingReadiness({
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
          epcBand: 'B',
        },
      }),
      accountSlug: 'bracketts',
      listingId: 'listing-1',
      listingStatus: 'marketing',
    });

    expect(blockers.some((item) => item.id === 'address')).toBe(true);
    expect(blockers.find((item) => item.id === 'address')?.actionLabel).toBe(
      'Open Edit',
    );
  });

  it('allows Continue when Rightmove can enable and only checklist items remain', () => {
    const channel = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        name: 'Venue',
        postcode: 'TN9 1AB',
        addressLine1: '1 High Street',
      },
      publications: [],
    });
    const blockers = collectChannelPublishBlockers({
      channel,
      readiness: getMarketingReadiness({ listing: emptyListing }),
      accountSlug: 'bracketts',
      listingId: 'listing-1',
      listingStatus: 'marketing',
    });

    expect(channel.canEnable).toBe(true);
    expect(blockers.every((item) => item.severity === 'checklist')).toBe(true);
    expect(blockers.length).toBeGreaterThan(0);
    expect(channelEnableCanContinue({ canEnable: channel.canEnable })).toBe(
      true,
    );
  });

  it('maps EACH field blockers to Edit', () => {
    const channel = getEachChannelStatus({
      listing: {
        status: 'marketing',
        externalId: '1',
        name: 'Unit 2',
        postcode: 'TN30 7LZ',
        disposalType: 'to_let',
        sizeMinSqft: null,
      },
      publications: [{ portal: 'each', status: 'unpublished' }],
    });
    const blockers = collectChannelPublishBlockers({
      channel,
      readiness: getMarketingReadiness({
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
          epcBand: 'B',
        },
      }),
      accountSlug: 'bracketts',
      listingId: 'listing-1',
      listingStatus: 'marketing',
    });

    expect(blockers.some((item) => item.id === 'size')).toBe(true);
    expect(blockers.find((item) => item.id === 'size')?.actionLabel).toBe(
      'Open Edit',
    );
    expect(blockers.every((item) => item.id !== 'status')).toBe(true);
  });
});
