import { describe, expect, it } from 'vitest';

import {
  channelNeedsRightmoveResync,
  getCirculationChannelStatus,
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
  hasSwitchedOnChannels,
  switchedOnChannelsHaveIssue,
} from '../channel-publish-status';

describe('getWebsiteChannelStatus', () => {
  it('is Off when unpublished', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '1' },
      publications: [{ portal: 'property_hive', status: 'unpublished' }],
    });
    expect(status.state).toBe('off');
    expect(status.switchOn).toBe(false);
    expect(status.canEnable).toBe(true);
  });

  it('cannot enable while draft', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'draft', externalId: null },
      publications: [{ portal: 'property_hive', status: 'unpublished' }],
    });
    expect(status.canEnable).toBe(false);
    expect(status.blockers[0]).toMatch(/Marketing or Under offer/);
  });

  it('is Blocked when on-market + on but missing feed id', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: null },
      publications: [{ portal: 'property_hive', status: 'published' }],
    });
    expect(status.state).toBe('blocked');
    expect(status.blockers.some((b) => /feed id/i.test(b))).toBe(true);
  });

  it('is Live when on-market, included, and has feed id', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '14e1a5eb' },
      publications: [{ portal: 'property_hive', status: 'published' }],
    });
    expect(status.state).toBe('live');
    expect(status.blockers).toEqual([]);
  });

  it('is Live but link broken when the public page returns 404', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '14e1a5eb' },
      publications: [{ portal: 'property_hive', status: 'published' }],
      publicPageUrl:
        'https://www.bracketts.co.uk/property/chapman-way-tunbridge-wells/',
      urlHealth: {
        url: 'https://www.bracketts.co.uk/property/chapman-way-tunbridge-wells/',
        ok: false,
        status: 404,
        reason: 'http_error',
      },
    });
    expect(status.state).toBe('live');
    expect(status.canEnable).toBe(true);
    expect(status.label).toBe('Live but link broken (404)');
    expect(status.issue).toBe('website_broken');
    expect(status.outOfSync).toBe(true);
    expect(status.blockers).toEqual([]);
  });

  it('is Live but public URL pending when the feed is live and no page URL is stored', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '14e1a5eb' },
      publications: [{ portal: 'property_hive', status: 'published' }],
      publicPageUrl: null,
    });
    expect(status.label).toBe('Live but public URL pending');
    expect(status.issue).toBe('website_pending');
    expect(status.canEnable).toBe(true);
  });

  it('ignores stale credentials-not-configured errors for XML feed', () => {
    const status = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: 'x' },
      publications: [
        {
          portal: 'property_hive',
          status: 'error',
          lastError: 'Property Hive credentials not configured',
        },
      ],
    });
    // switch defaults included when not unpublished — error row still "on"
    expect(status.switchOn).toBe(true);
    expect(status.state).toBe('live');
  });
});

describe('getEachChannelStatus', () => {
  it('blocks enable without size_min_sqft', () => {
    const status = getEachChannelStatus({
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
    expect(status.canEnable).toBe(false);
    expect(status.blockers.some((b) => /size from/i.test(b))).toBe(true);
  });

  it('is Blocked when included but size missing', () => {
    const status = getEachChannelStatus({
      listing: {
        status: 'marketing',
        externalId: '1',
        name: 'Unit 2',
        postcode: 'TN30 7LZ',
        disposalType: 'to_let',
        sizeMinSqft: null,
      },
      publications: [
        {
          portal: 'each',
          status: 'published',
          lastError: 'Missing EACH commercial fields: size_min_sqft',
        },
      ],
    });
    expect(status.state).toBe('blocked');
  });
});

describe('getRightmoveChannelStatus', () => {
  it('is Not pushed when there is no publication', () => {
    const status = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        name: 'Venue',
        postcode: 'TN9 1AB',
        addressLine1: '1 High Street',
      },
      publications: [],
    });
    expect(status.state).toBe('off');
    expect(status.label).toBe('Not pushed');
    expect(status.canEnable).toBe(true);
  });

  it('cannot enable Rightmove while draft', () => {
    const status = getRightmoveChannelStatus({
      listing: {
        status: 'draft',
        name: 'Venue Draft',
        postcode: 'TN9 1AB',
        addressLine1: '1 High Street',
      },
      publications: [],
    });
    expect(status.canEnable).toBe(false);
    expect(status.blockers[0]).toMatch(/Marketing or Under offer/);
  });

  it('is Live when published with a URL', () => {
    const status = getRightmoveChannelStatus({
      listing: { status: 'marketing' },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          externalUrl: 'https://www.rightmove.co.uk/properties/123',
        },
      ],
    });
    expect(status.state).toBe('live');
    expect(status.switchOn).toBe(true);
    expect(status.label).toBe('Live');
    expect(status.outOfSync).toBeFalsy();
  });

  it('is Live but Unsynced when last push is older than the listing', () => {
    const status = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        updatedAt: '2026-09-15T11:28:00.000Z',
      },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-07T11:47:00.000Z',
          externalUrl: 'https://www.rightmove.co.uk/properties/123',
        },
      ],
    });
    expect(status.state).toBe('live');
    expect(status.outOfSync).toBe(true);
    expect(status.label).toBe('Live but Unsynced');
    expect(status.detail).toMatch(/Behind the latest/);
    expect(status.detail).toMatch(/shortly/);
    expect(channelNeedsRightmoveResync('rightmove', status)).toBe(true);
  });

  it('does not mark published Rightmove unsynced without listing or media dates', () => {
    const status = getRightmoveChannelStatus({
      listing: { status: 'marketing' },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: null,
        },
      ],
    });
    expect(status.label).toBe('Live');
    expect(status.outOfSync).toBe(false);
  });

  it('is Live but Unsynced when last push is older than new media', () => {
    const status = getRightmoveChannelStatus({
      listing: { status: 'marketing' },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-07T11:47:00.000Z',
        },
      ],
      mediaCreatedAt: ['2026-09-15T10:00:00.000Z'],
    });
    expect(status.outOfSync).toBe(true);
    expect(status.label).toBe('Live but Unsynced');
  });

  it('stays Live when last sync is after listing and media updates', () => {
    const status = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        updatedAt: '2026-09-15T11:28:00.000Z',
      },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-15T12:00:00.000Z',
        },
      ],
      mediaCreatedAt: ['2026-09-11T10:00:00.000Z'],
    });
    expect(status.label).toBe('Live');
    expect(status.outOfSync).toBe(false);
  });

  it('is Failed when the last push errored', () => {
    const status = getRightmoveChannelStatus({
      listing: { status: 'marketing' },
      publications: [
        {
          portal: 'rightmove',
          status: 'error',
          lastError: 'Missing office',
        },
      ],
    });
    expect(status.state).toBe('blocked');
    expect(status.blockers).toContain('Missing office');
  });
});

describe('getCirculationChannelStatus', () => {
  it('is Off when auto-circulate is disabled', () => {
    const status = getCirculationChannelStatus({
      listing: { status: 'marketing', autoCirculateMatches: false },
    });
    expect(status.state).toBe('off');
    expect(status.switchOn).toBe(false);
    expect(status.canEnable).toBe(true);
  });

  it('is Blocked when included but not on a live match status', () => {
    const status = getCirculationChannelStatus({
      listing: { status: 'draft', autoCirculateMatches: true },
    });
    expect(status.state).toBe('blocked');
    expect(status.switchOn).toBe(true);
    expect(status.blockers[0]).toMatch(/Instructed, Marketing, or Under offer/);
  });

  it('is Included when auto-circulate is on and the listing can match', () => {
    const status = getCirculationChannelStatus({
      listing: { status: 'marketing', autoCirculateMatches: true },
    });
    expect(status.state).toBe('live');
    expect(status.label).toBe('Included');
    expect(status.blockers).toEqual([]);
  });
});

describe('switched-on channel sync health', () => {
  it('is orange when a switched-on channel is blocked or unsynced', () => {
    const website = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '1' },
      publications: [{ portal: 'property_hive', status: 'published' }],
    });
    const rightmove = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        updatedAt: '2026-09-15T11:28:00.000Z',
      },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-07T11:47:00.000Z',
        },
      ],
    });

    expect(hasSwitchedOnChannels([website, rightmove])).toBe(true);
    expect(switchedOnChannelsHaveIssue([website, rightmove])).toBe(true);
  });

  it('is orange when a switched-on pull feed is blocked', () => {
    const website = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: null },
      publications: [{ portal: 'property_hive', status: 'published' }],
    });
    const rightmove = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        updatedAt: '2026-09-15T11:28:00.000Z',
      },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-15T12:00:00.000Z',
        },
      ],
    });

    expect(website.state).toBe('blocked');
    expect(website.outOfSync).toBeFalsy();
    expect(switchedOnChannelsHaveIssue([website, rightmove])).toBe(true);
  });

  it('is green when every switched-on channel is live and in sync', () => {
    const website = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '1' },
      publications: [{ portal: 'property_hive', status: 'published' }],
    });
    const rightmove = getRightmoveChannelStatus({
      listing: {
        status: 'marketing',
        updatedAt: '2026-09-15T11:28:00.000Z',
      },
      publications: [
        {
          portal: 'rightmove',
          status: 'published',
          lastSyncAt: '2026-09-15T12:00:00.000Z',
        },
      ],
    });

    expect(switchedOnChannelsHaveIssue([website, rightmove])).toBe(false);
  });

  it('ignores channels that are switched off', () => {
    const website = getWebsiteChannelStatus({
      listing: { status: 'marketing', externalId: '1' },
      publications: [{ portal: 'property_hive', status: 'unpublished' }],
    });
    const rightmove = getRightmoveChannelStatus({
      listing: { status: 'marketing' },
      publications: [],
    });

    expect(hasSwitchedOnChannels([website, rightmove])).toBe(false);
    expect(switchedOnChannelsHaveIssue([website, rightmove])).toBe(false);
  });
});
