import type { SupabaseClient } from '@supabase/supabase-js';

import { describe, expect, it } from 'vitest';

import {
  PUBLIC_FEED_LISTING_MEDIA_PAGE_SIZE,
  type PropertyHiveFeedMediaInput,
  collectPropertyHiveFeedMedia,
  loadPublicFeedListingMedia,
} from '../property-hive-feed-media';

const UNIT_17 = '881c760d-b384-4251-8c2a-c7349be95396';

type MediaRow = PropertyHiveFeedMediaInput & {
  listing_id: string;
};

type RecordedQuery = {
  table: string;
  listingIds: readonly string[];
  isPrivate: boolean | undefined;
  orders: string[];
  range: [number, number];
};

function mediaRow(
  id: string,
  listingId: string,
  mediaType: string,
  sortOrder: number,
): MediaRow {
  return {
    id,
    listing_id: listingId,
    media_type: mediaType,
    file_name:
      mediaType === 'brochure'
        ? 'brochure.pdf'
        : mediaType === 'epc'
          ? 'epc.pdf'
          : `${id}.jpg`,
    mime_type: mediaType === 'image' ? 'image/jpeg' : 'application/pdf',
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function mockMediaClient(pages: MediaRow[][]) {
  const calls: RecordedQuery[] = [];

  const client = {
    from(table: string) {
      const state: Omit<RecordedQuery, 'table' | 'range'> = {
        listingIds: [],
        isPrivate: undefined,
        orders: [],
      };

      const builder = {
        select() {
          return builder;
        },
        in(_column: string, values: readonly string[]) {
          state.listingIds = values;
          return builder;
        },
        eq(_column: string, value: boolean) {
          state.isPrivate = value;
          return builder;
        },
        order(column: string) {
          state.orders.push(column);
          return builder;
        },
        range(from: number, to: number) {
          calls.push({
            table,
            listingIds: state.listingIds,
            isPrivate: state.isPrivate,
            orders: [...state.orders],
            range: [from, to],
          });
          const page = pages[calls.length - 1] ?? [];
          return Promise.resolve({ data: page, error: null });
        },
      };

      return builder;
    },
  };

  return { calls, client: client as unknown as SupabaseClient };
}

describe('loadPublicFeedListingMedia', () => {
  it('pages past PostgREST max_rows so brochure, EPC, and trailing images are kept', async () => {
    const pageSize = PUBLIC_FEED_LISTING_MEDIA_PAGE_SIZE;
    const firstPage = Array.from({ length: pageSize }, (_, index) =>
      mediaRow(
        `early-${index}`,
        index < 9 ? UNIT_17 : 'other-listing',
        'image',
        index,
      ),
    );
    const secondPage = [
      mediaRow('unit-17-last-photo', UNIT_17, 'image', pageSize),
      mediaRow('unit-17-brochure', UNIT_17, 'brochure', pageSize + 1),
      mediaRow('unit-17-epc', UNIT_17, 'epc', pageSize + 2),
    ];
    const { calls, client } = mockMediaClient([firstPage, secondPage]);

    const rows = await loadPublicFeedListingMedia<MediaRow>(client, [
      UNIT_17,
      'other-listing',
    ]);

    expect(calls.map((call) => call.range)).toEqual([
      [0, pageSize - 1],
      [pageSize, pageSize * 2 - 1],
    ]);
    expect(
      calls.every((call) => call.table === 'commercial_listing_media'),
    ).toBe(true);
    expect(calls.every((call) => call.isPrivate === false)).toBe(true);
    expect(calls[0]?.orders).toEqual(['sort_order', 'created_at', 'id']);
    expect(rows).toHaveLength(pageSize + 3);

    const unit17 = rows.filter((row) => row.listing_id === UNIT_17);
    const { images, files } = collectPropertyHiveFeedMedia(
      unit17,
      () => 'https://app.ozer.so/media',
    );

    expect(images.map((image) => image.name)).toEqual([
      ...Array.from({ length: 9 }, (_, index) => `early-${index}.jpg`),
      'unit-17-last-photo.jpg',
    ]);
    expect(files.map((file) => file.mediaType)).toEqual(['brochure', 'epc']);
    expect(files.map((file) => file.type)).toEqual(['11', '3']);
  });

  it('stops after a short page and does not query when there are no listings', async () => {
    const { calls, client } = mockMediaClient([
      [mediaRow('only', UNIT_17, 'brochure', 0)],
    ]);

    const rows = await loadPublicFeedListingMedia<MediaRow>(client, [UNIT_17]);
    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(1);

    const empty = mockMediaClient([]);
    await expect(loadPublicFeedListingMedia(empty.client, [])).resolves.toEqual(
      [],
    );
    expect(empty.calls).toHaveLength(0);
  });

  it('requests the next page when the first page is exactly max_rows, then stops', async () => {
    const pageSize = PUBLIC_FEED_LISTING_MEDIA_PAGE_SIZE;
    const fullPage = Array.from({ length: pageSize }, (_, index) =>
      mediaRow(`row-${index}`, UNIT_17, 'image', index),
    );
    const { calls, client } = mockMediaClient([fullPage]);

    const rows = await loadPublicFeedListingMedia<MediaRow>(client, [UNIT_17]);

    expect(rows).toHaveLength(pageSize);
    expect(calls.map((call) => call.range)).toEqual([
      [0, pageSize - 1],
      [pageSize, pageSize * 2 - 1],
    ]);
  });

  it('throws the PostgREST error instead of returning a partial page', async () => {
    const client = {
      from() {
        const builder = {
          select: () => builder,
          in: () => builder,
          eq: () => builder,
          order: () => builder,
          range: () =>
            Promise.resolve({
              data: null,
              error: { message: 'statement timeout' },
            }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    await expect(loadPublicFeedListingMedia(client, [UNIT_17])).rejects.toThrow(
      'statement timeout',
    );
  });
});
