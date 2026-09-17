import { describe, expect, it } from 'vitest';

import {
  describeRightmoveUnsyncedChanges,
  statusChangesFromListingEvents,
} from '../rightmove-unsynced-changes';

describe('statusChangesFromListingEvents', () => {
  it('keeps only status_changed events and their stored statuses', () => {
    expect(
      statusChangesFromListingEvents([
        {
          eventType: 'media_changed',
          createdAt: '2026-09-16T10:00:00.000Z',
          metadata: { status: 'marketing' },
        },
        {
          eventType: 'status_changed',
          createdAt: '2026-09-16T11:00:00.000Z',
          metadata: { previousStatus: 'marketing', status: 'under_offer' },
        },
      ]),
    ).toEqual([
      {
        previousStatus: 'marketing',
        status: 'under_offer',
        createdAt: '2026-09-16T11:00:00.000Z',
      },
    ]);
  });
});

describe('describeRightmoveUnsyncedChanges', () => {
  it('explains a missing last-sync time without listing historic media as new', () => {
    const result = describeRightmoveUnsyncedChanges({
      lastSyncAt: null,
      listingUpdatedAt: '2026-09-15T09:00:00.000Z',
      media: [
        {
          mediaType: 'image',
          isCover: true,
          createdAt: '2026-09-01T09:00:00.000Z',
        },
      ],
    });

    expect(result.lastSyncText).toBe('No last-sync time is stored');
    expect(result.items.map((item) => item.text)).toEqual([
      'Rightmove is live but we have no last-sync time, so this listing is marked Unsynced until the next successful push',
      expect.stringMatching(/^Listing details last updated \(/),
    ]);
    expect(result.items.some((item) => /media/i.test(item.text))).toBe(false);
  });

  it('lists listing details, status change, and new media after last sync', () => {
    const result = describeRightmoveUnsyncedChanges({
      lastSyncAt: '2026-09-10T10:00:00.000Z',
      listingUpdatedAt: '2026-09-16T12:00:00.000Z',
      statusChanges: [
        {
          previousStatus: 'marketing',
          status: 'under_offer',
          createdAt: '2026-09-16T11:30:00.000Z',
        },
      ],
      media: [
        {
          mediaType: 'image',
          isCover: true,
          createdAt: '2026-09-16T09:00:00.000Z',
        },
        {
          mediaType: 'image',
          isCover: false,
          createdAt: '2026-09-16T09:05:00.000Z',
        },
        {
          mediaType: 'image',
          isCover: false,
          createdAt: '2026-09-16T09:06:00.000Z',
        },
        {
          mediaType: 'epc',
          createdAt: '2026-09-16T09:10:00.000Z',
        },
        {
          mediaType: 'brochure',
          createdAt: '2026-09-01T09:00:00.000Z',
        },
      ],
    });

    expect(result.lastSyncText).toMatch(/^Last synced /);
    expect(result.items.map((item) => item.text)).toEqual([
      expect.stringMatching(/^Status changed from Marketing to Under offer \(/),
      expect.stringMatching(/^Listing details updated \(/),
      'New media since last sync: 1 main photo, 2 gallery photos and 1 EPC',
    ]);
    expect(result.footnote).toMatch(/field-by-field/i);
  });

  it('ignores private media and status changes from before last sync', () => {
    const result = describeRightmoveUnsyncedChanges({
      lastSyncAt: '2026-09-10T10:00:00.000Z',
      listingUpdatedAt: '2026-09-09T12:00:00.000Z',
      statusChanges: [
        {
          previousStatus: 'instructed',
          status: 'marketing',
          createdAt: '2026-09-08T11:00:00.000Z',
        },
      ],
      media: [
        {
          mediaType: 'brochure',
          createdAt: '2026-09-16T09:00:00.000Z',
          isPrivate: true,
        },
      ],
    });

    expect(result.items.map((item) => item.text)).toEqual([
      'The disposal or its media is newer than the last successful Rightmove push',
    ]);
  });

  it('does not invent specific field names when only the listing timestamp moved', () => {
    const result = describeRightmoveUnsyncedChanges({
      lastSyncAt: '2026-09-10T10:00:00.000Z',
      listingUpdatedAt: '2026-09-16T12:00:00.000Z',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.text).toMatch(/^Listing details updated \(/);
    expect(result.items[0]?.text).not.toMatch(/website|postcode|rent/i);
  });
});
