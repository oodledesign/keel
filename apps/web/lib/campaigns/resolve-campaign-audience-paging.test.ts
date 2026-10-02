import type { SupabaseClient } from '@supabase/supabase-js';

import { describe, expect, it } from 'vitest';

import { CAMPAIGN_AUDIENCE_PAGE_SIZE } from './page-query';
import { resolveCampaignAudience } from './resolve-campaign-audience';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const LIST_ID = '22222222-2222-4222-8222-222222222222';

type Page = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function mockPagedClient(options: {
  pages: Record<string, Page[]>;
  singles?: Record<string, unknown>;
}) {
  const ranges: Array<{ table: string; from: number; to: number }> = [];
  const seen = new Map<string, number>();

  const client = {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        not() {
          return builder;
        },
        is() {
          return builder;
        },
        in() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle: async () => ({
          data: options.singles?.[table] ?? null,
          error: null,
        }),
        range(from: number, to: number) {
          ranges.push({ table, from, to });
          const index = seen.get(table) ?? 0;
          seen.set(table, index + 1);
          const page = options.pages[table]?.[index] ?? {
            data: [],
            error: null,
          };
          return Promise.resolve(page);
        },
      };

      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, ranges };
}

function person(index: number) {
  return {
    id: `client-${index}`,
    email: `person-${index}@example.com`,
    display_name: `Person ${index}`,
  };
}

function member(index: number) {
  return {
    contact_id: `contact-${index}`,
    contacts: {
      id: `contact-${index}`,
      email: `member-${index}@example.com`,
      full_name: `Member ${index}`,
    },
  };
}

describe('resolveCampaignAudience paging', () => {
  it('returns clients past the PostgREST page size instead of stopping at 5000', async () => {
    const pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE;
    const { client, ranges } = mockPagedClient({
      pages: {
        clients: [
          {
            data: Array.from({ length: pageSize }, (_, index) => person(index)),
            error: null,
          },
          { data: [person(pageSize)], error: null },
        ],
      },
    });

    const resolved = await resolveCampaignAudience(
      client,
      ACCOUNT_ID,
      'clients',
      {},
    );

    expect(resolved).toHaveLength(pageSize + 1);
    expect(resolved.at(-1)?.email).toBe(`person-${pageSize}@example.com`);
    expect(
      ranges
        .filter((call) => call.table === 'clients')
        .map((call) => [call.from, call.to]),
    ).toEqual([
      [0, pageSize - 1],
      [pageSize, pageSize * 2 - 1],
    ]);
  });

  it('throws when a later clients page fails instead of returning the first page', async () => {
    const pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE;
    const { client } = mockPagedClient({
      pages: {
        clients: [
          {
            data: Array.from({ length: pageSize }, (_, index) => person(index)),
            error: null,
          },
          { data: null, error: { message: 'statement timeout' } },
        ],
      },
    });

    await expect(
      resolveCampaignAudience(client, ACCOUNT_ID, 'clients', {}),
    ).rejects.toThrow('statement timeout');
  });

  it('surfaces a contacts page error instead of resolving nobody', async () => {
    const { client } = mockPagedClient({
      pages: {
        contacts: [
          {
            data: null,
            error: { message: 'column account_id does not exist' },
          },
        ],
      },
    });

    await expect(
      resolveCampaignAudience(client, ACCOUNT_ID, 'contacts', {}),
    ).rejects.toThrow('column account_id does not exist');
  });

  it('pages manual list members across a page boundary', async () => {
    const pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE;
    const { client, ranges } = mockPagedClient({
      singles: {
        campaign_audience_lists: {
          id: LIST_ID,
          source: 'manual',
          match_mode: 'all',
          filters: [],
        },
      },
      pages: {
        campaign_audience_list_members: [
          {
            data: Array.from({ length: pageSize }, (_, index) => member(index)),
            error: null,
          },
          { data: [member(pageSize)], error: null },
        ],
      },
    });

    const resolved = await resolveCampaignAudience(client, ACCOUNT_ID, 'list', {
      listId: LIST_ID,
    });

    expect(resolved).toHaveLength(pageSize + 1);
    expect(resolved.at(-1)?.email).toBe(`member-${pageSize}@example.com`);
    expect(resolved.at(-1)?.contactId).toBe(`contact-${pageSize}`);
    expect(
      ranges
        .filter((call) => call.table === 'campaign_audience_list_members')
        .map((call) => call.from),
    ).toEqual([0, pageSize]);
  });
});
