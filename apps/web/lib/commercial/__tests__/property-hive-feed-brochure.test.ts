import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LISTING_ID = '33dde750-8324-46b7-9913-4b0685e3f3fd';
const ACCOUNT_ID = 'c4e7c6b1-e4f0-43ee-a768-6b3782e50d62';
const TOKEN = 'feed-token-123';

const queried: string[] = [];

const rows: Record<string, unknown> = {
  commercial_portal_credentials: {
    account_id: ACCOUNT_ID,
    metadata: { xml_feed_token: TOKEN },
  },
  commercial_listings: [
    {
      id: LISTING_ID,
      account_id: ACCOUNT_ID,
      status: 'marketing',
      external_id: 'K-1001',
      name: 'New Class E unit',
      address_line1: '1 High Street',
      address_line2: null,
      town: 'Tonbridge',
      county: 'Kent',
      postcode: 'TN9 1AA',
      disposal_type: 'to_let',
      asking_rent_pence: 1_200_000,
      rent_frequency: 'pa',
      size_min_sqft: 900,
      size_max_sqft: 900,
      summary: 'Ground-floor unit.',
      description: 'A ground-floor unit on the high street.',
      key_points: [],
      updated_at: '2026-10-01T10:00:00Z',
      created_at: '2026-09-01T10:00:00Z',
    },
  ],
  commercial_listing_media: [
    {
      id: 'media-photo',
      listing_id: LISTING_ID,
      media_type: 'image',
      storage_path: `${ACCOUNT_ID}/${LISTING_ID}/front.jpg`,
      external_url: null,
      file_name: 'front.jpg',
      mime_type: 'image/jpeg',
      sort_order: 0,
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'media-brochure',
      listing_id: LISTING_ID,
      media_type: 'brochure',
      storage_path: `${ACCOUNT_ID}/${LISTING_ID}/brochure.pdf`,
      external_url: null,
      file_name: 'brochure.pdf',
      mime_type: 'application/pdf',
      sort_order: 0,
      created_at: '2026-10-01T10:00:00Z',
    },
  ],
};

function fakeClient() {
  const client = {
    from(table: string) {
      queried.push(table);
      const result = () => {
        const value = rows[table];
        return {
          data: Array.isArray(value) ? value : value ? [value] : [],
          error: null,
        };
      };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'order', 'neq', 'is']) {
        builder[method] = () => builder;
      }
      builder.range = (from: number) =>
        Promise.resolve(from === 0 ? result() : { data: [], error: null });
      builder.maybeSingle = () =>
        Promise.resolve({ data: rows[table] ?? null, error: null });
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject);
      return builder;
    },
    schema() {
      return client;
    },
    storage: {
      from() {
        return {
          createSignedUrls: async () => ({ data: [], error: null }),
        };
      },
    },
  };
  return client;
}

vi.mock('@kit/supabase/server-admin-client', () => ({
  getSupabaseServerAdminClient: () => fakeClient(),
}));

describe('buildCommercialFeedXml brochures', () => {
  beforeEach(() => {
    queried.length = 0;
    vi.stubEnv('NEXT_PUBLIC_APP_SITE_URL', 'https://app.ozer.so');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['property_hive', 'each'] as const)(
    'sends only uploaded or published brochure media to the %s feed',
    async (portal) => {
      const { buildCommercialFeedXml } = await import('../property-hive-feed');
      const result = await buildCommercialFeedXml(TOKEN, portal);

      expect(result?.accountId).toBe(ACCOUNT_ID);
      expect(result?.xml).toContain('media-brochure');
      expect(result?.xml).not.toContain('listing-brochure/');
      expect(queried).not.toContain('commercial_listing_brochures');
    },
  );
});
