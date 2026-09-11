import { describe, expect, it, vi } from 'vitest';

import { createCommercialCirculationService } from '../circulation.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'Dana@Example.com';

function createPreferenceClient(options: {
  row?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
}) {
  const updates: Array<{
    table: string;
    payload: Record<string, unknown>;
    filters: Array<[string, string, unknown]>;
  }> = [];

  const client = {
    from: vi.fn((table: string) => {
      const filters: Array<[string, string, unknown]> = [];
      const query: Record<string, unknown> = {};
      Object.assign(query, {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push(['eq', column, value]);
          return query;
        }),
        neq: vi.fn((column: string, value: unknown) => {
          filters.push(['neq', column, value]);
          return query;
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push({ table, payload, filters });
          return query;
        }),
        maybeSingle: vi.fn(async () => ({
          data: options.row ?? null,
          error: null,
        })),
        then: (
          resolve: (value: { error: { message: string } | null }) => unknown,
        ) => resolve({ error: options.updateError ?? null }),
      });
      return query;
    }),
  };

  return { client, updates };
}

describe('commercial circulation preference pause and restore', () => {
  it('pauses matching_disposals without overwriting a suppression', async () => {
    const { client, updates } = createPreferenceClient({ row: null });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.unsubscribe(ACCOUNT_ID, EMAIL);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: 'commercial_marketing_preferences',
      payload: {
        marketing_status: 'unsubscribed',
      },
    });
    expect(updates[0]!.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'account_id', ACCOUNT_ID],
        ['eq', 'email', 'dana@example.com'],
        ['eq', 'purpose', 'matching_disposals'],
        ['neq', 'marketing_status', 'suppressed'],
      ]),
    );
  });

  it('restores an unsubscribed matching_disposals row', async () => {
    const { client, updates } = createPreferenceClient({
      row: {
        id: 'circ-1',
        marketing_status: 'unsubscribed',
      },
    });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.resubscribe(ACCOUNT_ID, EMAIL, {
      consentSource: 'unsubscribe_page_resubscribe',
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: 'commercial_marketing_preferences',
      payload: {
        marketing_status: 'subscribed',
        unsubscribed_at: null,
        consent_source: 'unsubscribe_page_resubscribe',
      },
    });
    expect(updates[0]!.filters).toEqual([['eq', 'id', 'circ-1']]);
  });

  it('does not restore a bounce or complaint suppression', async () => {
    const { client, updates } = createPreferenceClient({
      row: {
        id: 'circ-1',
        marketing_status: 'suppressed',
      },
    });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.resubscribe(ACCOUNT_ID, EMAIL, {
      consentSource: 'unsubscribe_page_resubscribe',
    });

    expect(updates).toHaveLength(0);
  });

  it('is a no-op when there is no circulation preference row', async () => {
    const { client, updates } = createPreferenceClient({ row: null });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.resubscribe(ACCOUNT_ID, EMAIL);

    expect(updates).toHaveLength(0);
  });

  it('is a no-op when the row is already subscribed', async () => {
    const { client, updates } = createPreferenceClient({
      row: {
        id: 'circ-1',
        marketing_status: 'subscribed',
      },
    });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.resubscribe(ACCOUNT_ID, EMAIL);

    expect(updates).toHaveLength(0);
  });
});
