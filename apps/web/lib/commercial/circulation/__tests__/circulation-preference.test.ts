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
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];

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
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserts.push({ table, payload });
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

  return { client, updates, inserts };
}

describe('commercial circulation preference pause and restore', () => {
  it('unsubscribes a subscribed row and records the source', async () => {
    const { client, updates, inserts } = createPreferenceClient({
      row: { id: 'circ-1', marketing_status: 'subscribed' },
    });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.unsubscribe(ACCOUNT_ID, EMAIL, { source: 'one_click' });

    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: 'commercial_marketing_preferences',
      payload: {
        marketing_status: 'unsubscribed',
        unsubscribe_source: 'one_click',
      },
    });
    expect(updates[0]!.filters).toEqual(
      expect.arrayContaining([['eq', 'id', 'circ-1']]),
    );
  });

  it('creates an unsubscribed row when the contact has none yet', async () => {
    const { client, updates, inserts } = createPreferenceClient({ row: null });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.unsubscribe(ACCOUNT_ID, EMAIL, {
      source: 'confirm_page',
    });

    expect(updates).toHaveLength(0);
    expect(inserts).toEqual([
      {
        table: 'commercial_marketing_preferences',
        payload: expect.objectContaining({
          account_id: ACCOUNT_ID,
          email: 'dana@example.com',
          purpose: 'matching_disposals',
          marketing_status: 'unsubscribed',
          unsubscribe_source: 'confirm_page',
        }),
      },
    ]);
  });

  it('never overwrites a bounce or complaint suppression', async () => {
    const { client, updates, inserts } = createPreferenceClient({
      row: { id: 'circ-1', marketing_status: 'suppressed' },
    });
    const circulation = createCommercialCirculationService(client as never);

    await circulation.unsubscribe(ACCOUNT_ID, EMAIL);

    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
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
