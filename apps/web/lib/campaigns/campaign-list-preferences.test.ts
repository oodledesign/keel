import { describe, expect, it, vi } from 'vitest';

import {
  leaveAllPublicAudienceLists,
  listPublicAudiencePreferences,
  loadListOptOutEmails,
  setPublicAudienceListSubscription,
} from './campaign-list-preferences';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const LIST_ID = '22222222-2222-4222-8222-222222222222';
const PRIVATE_ID = '33333333-3333-4333-8333-333333333333';

function createClient(options: {
  lists?: Array<Record<string, unknown>>;
  optOuts?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  contacts?: Array<Record<string, unknown>>;
  list?: Record<string, unknown> | null;
}) {
  const upserts: Array<{ table: string; payload: unknown }> = [];
  const deletes: Array<{ table: string }> = [];
  const inserts: Array<{ table: string; payload: unknown }> = [];

  const client = {
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      Object.assign(query, {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        ilike: vi.fn(() => query),
        order: vi.fn(() => query),
        range: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data:
            table === 'campaign_audience_lists' ? (options.list ?? null) : null,
          error: null,
        })),
        single: vi.fn(async () => ({
          data: { id: 'contact-1' },
          error: null,
        })),
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload });
          return query;
        }),
        upsert: vi.fn((payload: unknown) => {
          upserts.push({ table, payload });
          return query;
        }),
        delete: vi.fn(() => {
          deletes.push({ table });
          return query;
        }),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
          if (table === 'campaign_audience_lists') {
            return resolve({ data: options.lists ?? [], error: null });
          }
          if (table === 'campaign_audience_list_opt_outs') {
            return resolve({ data: options.optOuts ?? [], error: null });
          }
          if (table === 'campaign_audience_list_members') {
            return resolve({ data: options.members ?? [], error: null });
          }
          if (table === 'contacts') {
            return resolve({ data: options.contacts ?? [], error: null });
          }
          return resolve({ data: [], error: null });
        },
      });
      return query;
    }),
  };

  return { client, upserts, deletes, inserts };
}

describe('campaign list preferences', () => {
  it('loads opt-out emails in lowercase', async () => {
    const { client } = createClient({
      optOuts: [{ email: 'Dana@Example.com' }],
    });

    await expect(
      loadListOptOutEmails(client as never, ACCOUNT_ID, LIST_ID),
    ).resolves.toEqual(new Set(['dana@example.com']));
  });

  it('marks a manual list subscribed only when this contact is a member', async () => {
    const { client } = createClient({
      lists: [
        { id: LIST_ID, name: 'News', source: 'manual' },
        { id: PRIVATE_ID, name: 'Investors', source: 'subscribers' },
      ],
      optOuts: [],
      contacts: [{ id: 'contact-1' }],
      members: [{ list_id: LIST_ID }],
    });

    await expect(
      listPublicAudiencePreferences(
        client as never,
        ACCOUNT_ID,
        'Dana@Example.com',
      ),
    ).resolves.toEqual([
      { id: LIST_ID, name: 'News', subscribed: true },
      { id: PRIVATE_ID, name: 'Investors', subscribed: true },
    ]);
  });

  it('treats opted-out public lists as unsubscribed', async () => {
    const { client } = createClient({
      lists: [{ id: LIST_ID, name: 'News', source: 'subscribers' }],
      optOuts: [{ list_id: LIST_ID }],
      members: [],
    });

    await expect(
      listPublicAudiencePreferences(
        client as never,
        ACCOUNT_ID,
        'dana@example.com',
      ),
    ).resolves.toEqual([{ id: LIST_ID, name: 'News', subscribed: false }]);
  });

  it('leaves every public list on unsubscribe-all', async () => {
    const { client, upserts, deletes } = createClient({
      lists: [
        { id: LIST_ID, name: 'News', source: 'manual' },
        { id: PRIVATE_ID, name: 'Alerts', source: 'subscribers' },
      ],
      contacts: [{ id: 'contact-1' }],
    });

    await leaveAllPublicAudienceLists(
      client as never,
      ACCOUNT_ID,
      'dana@example.com',
    );

    expect(upserts[0]).toMatchObject({
      table: 'campaign_audience_list_opt_outs',
      payload: [
        {
          account_id: ACCOUNT_ID,
          list_id: LIST_ID,
          email: 'dana@example.com',
        },
        {
          account_id: ACCOUNT_ID,
          list_id: PRIVATE_ID,
          email: 'dana@example.com',
        },
      ],
    });
    expect(deletes).toEqual(
      expect.arrayContaining([{ table: 'campaign_audience_list_members' }]),
    );
  });

  it('refuses to change a private list via the public token path', async () => {
    const { client, upserts } = createClient({ list: null });

    await expect(
      setPublicAudienceListSubscription({
        client: client as never,
        accountId: ACCOUNT_ID,
        email: 'dana@example.com',
        listId: PRIVATE_ID,
        subscribed: true,
      }),
    ).resolves.toBeNull();
    expect(upserts).toEqual([]);
  });
});
