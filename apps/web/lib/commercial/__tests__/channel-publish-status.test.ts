import { describe, expect, it } from 'vitest';

import {
  getEachChannelStatus,
  getWebsiteChannelStatus,
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
