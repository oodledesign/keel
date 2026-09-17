import { describe, expect, it } from 'vitest';

import {
  channelNeedsRightmoveResync,
  switchedOnChannelsHaveIssue,
} from '../channel-publish-status';
import { buildListingFeedChannels } from '../listing-feed-channels';

const listing = {
  id: 'listing-1',
  status: 'marketing',
  externalId: '14e1a5eb',
  websiteUrl: 'https://www.example.com/property/camden-road/',
  sizeMinSqft: 77918,
  name: '132-134 Camden Road',
  postcode: 'TN1 2QZ',
  addressLine1: '132-134 Camden Road',
  disposalType: 'investment',
  updatedAt: '2026-09-16T10:00:00.000Z',
  autoCirculateMatches: false,
};

describe('buildListingFeedChannels', () => {
  it('builds compact Website/EACH live labels without long detail copy', () => {
    const channels = buildListingFeedChannels({
      listing,
      accountSlug: 'bracketts',
      publications: [
        { portal: 'property_hive', status: 'published' },
        { portal: 'each', status: 'published' },
      ],
    });

    const website = channels.find((channel) => channel.key === 'website');
    const each = channels.find((channel) => channel.key === 'each');

    expect(website?.status.label).toBe('Live');
    expect(each?.status.label).toBe('Live');
    expect(website?.status.label).not.toMatch(/Property Hive/);
    expect(each?.status.label).not.toMatch(/Property Hive/);
  });

  it('flags unsynced Rightmove so the Feeds control can show a warning', () => {
    const channels = buildListingFeedChannels({
      listing,
      accountSlug: 'bracketts',
      publications: [
        { portal: 'property_hive', status: 'published' },
        { portal: 'each', status: 'published' },
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-15T09:00:00.000Z',
        },
      ],
      mediaCreatedAt: ['2026-09-16T11:00:00.000Z'],
    });
    const statuses = channels.map((channel) => channel.status);
    const rightmove = channels.find((channel) => channel.key === 'rightmove');

    expect(rightmove?.status.label).toBe('Pending sync');
    expect(switchedOnChannelsHaveIssue(statuses)).toBe(true);
    expect(channelNeedsRightmoveResync('rightmove', rightmove!.status)).toBe(
      true,
    );
  });
});
