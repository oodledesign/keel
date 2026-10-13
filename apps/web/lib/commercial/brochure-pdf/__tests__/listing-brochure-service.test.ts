import type { SupabaseClient } from '@supabase/supabase-js';

import { describe, expect, it, vi } from 'vitest';

import { createListingBrochureService } from '~/home/[account]/listings/_lib/server/listing-brochure.service';

vi.mock('~/lib/commercial/brochure-pdf/load-listing-brochure-data', () => ({
  loadListingBrochureData: vi.fn(),
}));

const LISTING = '33dde750-8324-46b7-9913-4b0685e3f3fd';
const ACCOUNT = 'c4e7c6b1-e4f0-43ee-a768-6b3782e50d62';

type Row = Record<string, unknown>;

function row(orientation: string, overrides: Row = {}): Row {
  return {
    id: `doc-${orientation}`,
    account_id: ACCOUNT,
    listing_id: LISTING,
    template_id: 'classic',
    page_size: 'A4',
    orientation,
    pages: [],
    storage_path: null,
    updated_at: '2026-10-01T10:00:00.000Z',
    approved_at: null,
    approved_by: null,
    published_media_id: null,
    ...overrides,
  };
}

/** In-memory `commercial_listing_brochures` supporting the filters the service uses. */
function fakeClient(rows: Row[]) {
  return {
    from() {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      const run = () => {
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        if (patch) for (const r of matched) Object.assign(r, patch);
        return { data: matched, error: null };
      };
      const builder = {
        select: () => builder,
        update: (values: Row) => {
          patch = values;
          return builder;
        },
        eq: (col: string, value: unknown) => {
          filters.push((r) => r[col] === value);
          return builder;
        },
        neq: (col: string, value: unknown) => {
          filters.push((r) => r[col] !== value);
          return builder;
        },
        not: (col: string, op: string, value: unknown) => {
          if (op === 'is' && value === null) {
            filters.push((r) => r[col] != null);
          }
          return builder;
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(run()).then(resolve, reject),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('ListingBrochureService.recordPublished', () => {
  it('approves the orientation, detaches the other and returns replaced media', async () => {
    const rows = [
      row('landscape', {
        approved_at: '2026-09-01T10:00:00.000Z',
        published_media_id: 'old-landscape-pdf',
      }),
      row('portrait', {
        approved_at: '2026-09-05T10:00:00.000Z',
        published_media_id: 'old-portrait-pdf',
      }),
    ];
    const service = createListingBrochureService(fakeClient(rows));

    const replaced = await service.recordPublished({
      listingId: LISTING,
      accountId: ACCOUNT,
      orientation: 'landscape',
      mediaId: 'new-pdf',
      userId: 'user-1',
    });

    expect(replaced.sort()).toEqual(['old-landscape-pdf', 'old-portrait-pdf']);
    const [landscape, portrait] = rows;
    expect(landscape).toMatchObject({
      published_media_id: 'new-pdf',
      approved_by: 'user-1',
    });
    expect(
      new Date(landscape!.approved_at as string).getTime(),
    ).toBeGreaterThan(new Date('2026-09-01T10:00:00.000Z').getTime());
    expect(portrait!.published_media_id).toBeNull();
  });

  it('returns nothing to remove on the first publish', async () => {
    const rows = [row('portrait')];
    const service = createListingBrochureService(fakeClient(rows));

    const replaced = await service.recordPublished({
      listingId: LISTING,
      accountId: ACCOUNT,
      orientation: 'portrait',
      mediaId: 'first-pdf',
      userId: 'user-1',
    });

    expect(replaced).toEqual([]);
    expect(rows[0]).toMatchObject({
      published_media_id: 'first-pdf',
      approved_by: 'user-1',
    });
  });
});

describe('ListingBrochureService.savePages', () => {
  /** Records each upsert; without the settings column it fails like PostgREST. */
  function upsertClient({ hasSettingsColumn }: { hasSettingsColumn: boolean }) {
    const upserts: Row[] = [];
    const client = {
      from: () => ({
        upsert: (values: Row) => {
          upserts.push(values);
          const error =
            !hasSettingsColumn && 'settings' in values
              ? {
                  code: 'PGRST204',
                  message:
                    "Could not find the 'settings' column of 'commercial_listing_brochures' in the schema cache",
                }
              : null;
          return {
            select: () => ({
              single: async () => ({
                data: error ? null : row('landscape', values),
                error,
              }),
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;
    return { client, upserts };
  }

  const footer = { footer: { noticeText: 'Strictly subject to contract' } };

  it('saves the brochure settings with the pages', async () => {
    const { client, upserts } = upsertClient({ hasSettingsColumn: true });
    const saved = await createListingBrochureService(client).savePages({
      listingId: LISTING,
      accountId: ACCOUNT,
      orientation: 'landscape',
      templateId: 'classic',
      pages: [],
      settings: footer,
    });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.settings).toEqual(footer);
    expect(saved.settings).toEqual(footer);
  });

  it('leaves saved settings untouched when none are sent', async () => {
    const { client, upserts } = upsertClient({ hasSettingsColumn: true });
    await createListingBrochureService(client).savePages({
      listingId: LISTING,
      accountId: ACCOUNT,
      orientation: 'landscape',
      templateId: 'classic',
      pages: [],
    });
    expect(upserts[0]).not.toHaveProperty('settings');
  });

  it('still saves the pages before the settings column exists', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, upserts } = upsertClient({ hasSettingsColumn: false });
    const saved = await createListingBrochureService(client).savePages({
      listingId: LISTING,
      accountId: ACCOUNT,
      orientation: 'landscape',
      templateId: 'classic',
      pages: [],
      settings: footer,
    });
    expect(upserts).toHaveLength(2);
    expect(upserts[1]).not.toHaveProperty('settings');
    expect(saved.settings).toEqual({});
    error.mockRestore();
  });
});
