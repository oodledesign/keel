import { describe, expect, it, vi } from 'vitest';

import { recordCirculationDelivery } from '../circulation-delivery';
import { createCommercialCirculationService } from '../circulation.service';

vi.mock('server-only', () => ({}));

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const SEND_ID = '22222222-2222-4222-8222-222222222222';
const STATE_TABLE = 'commercial_circulation_contact_state';
const PREFERENCES_TABLE = 'commercial_marketing_preferences';

type Call = { table: string; op: string; payload?: unknown; args?: unknown[] };

/**
 * Records every table operation. Any read of the consent table returns no
 * row, i.e. a contact who has never opted in.
 */
function createRecordingClient(options?: {
  rpcResult?: boolean;
  stateRows?: Array<{ email: string; last_circulated_at: string }>;
}) {
  const calls: Call[] = [];
  const rpc = vi.fn(async () => ({
    data: options?.rpcResult ?? true,
    error: null,
  }));

  const client = {
    rpc,
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      const chain = (op: string) =>
        vi.fn((...args: unknown[]) => {
          calls.push({ table, op, args });
          return query;
        });
      Object.assign(query, {
        select: chain('select'),
        eq: chain('eq'),
        in: chain('in'),
        not: chain('not'),
        update: vi.fn((payload: unknown) => {
          calls.push({ table, op: 'update', payload });
          return query;
        }),
        upsert: vi.fn((payload: unknown, ...rest: unknown[]) => {
          calls.push({ table, op: 'upsert', payload, args: rest });
          return query;
        }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: table === STATE_TABLE ? (options?.stateRows ?? []) : [],
            error: null,
          }),
      });
      return query;
    }),
  };

  return { client, calls, rpc };
}

describe('circulation send state for contacts with no consent row', () => {
  it('claims through the state-table RPC without touching the consent table', async () => {
    const { client, calls, rpc } = createRecordingClient();
    const circulation = createCommercialCirculationService(client as never);
    const since = new Date('2026-09-24T00:00:00.000Z');

    const claimed = await circulation.claimContactForSend({
      accountId: ACCOUNT_ID,
      email: ' Dana@Example.com ',
      notCirculatedSince: since,
    });

    expect(claimed).toBe(true);
    expect(rpc).toHaveBeenCalledWith('claim_commercial_circulation_contact', {
      p_account_id: ACCOUNT_ID,
      p_email: 'dana@example.com',
      p_not_circulated_since: since.toISOString(),
    });
    expect(calls.filter((c) => c.table === PREFERENCES_TABLE)).toHaveLength(0);
  });

  it('reports a lost claim as false', async () => {
    const { client } = createRecordingClient({ rpcResult: false });
    const circulation = createCommercialCirculationService(client as never);

    await expect(
      circulation.claimContactForSend({
        accountId: ACCOUNT_ID,
        email: 'dana@example.com',
      }),
    ).resolves.toBe(false);
  });

  it('releases the claim on the state table', async () => {
    const { client, calls } = createRecordingClient();
    const circulation = createCommercialCirculationService(client as never);

    await circulation.releaseContactClaim(ACCOUNT_ID, 'Dana@Example.com');

    const update = calls.find(
      (c) => c.table === STATE_TABLE && c.op === 'update',
    );
    expect(update?.payload).toMatchObject({ circulation_claimed_at: null });
    expect(update?.payload).toHaveProperty('updated_at');
    expect(calls.filter((c) => c.table === PREFERENCES_TABLE)).toHaveLength(0);
  });

  it('records the send and releases the claim via an upsert', async () => {
    const { client, calls } = createRecordingClient();

    await recordCirculationDelivery(client as never, {
      accountId: ACCOUNT_ID,
      email: 'Dana@Example.com',
      sendId: SEND_ID,
      listingIds: [],
      matchPairs: [],
      matchNotes: 'test',
    });

    const upsert = calls.find(
      (c) => c.table === STATE_TABLE && c.op === 'upsert',
    );
    expect(upsert?.payload).toMatchObject({
      account_id: ACCOUNT_ID,
      email: 'dana@example.com',
      circulation_claimed_at: null,
    });
    expect(
      (upsert?.payload as { last_circulated_at: unknown }).last_circulated_at,
    ).toEqual(expect.any(String));
    expect(upsert?.args?.[0]).toEqual({ onConflict: 'account_id,email' });
  });

  it('does not write to the consent table unless a digest fingerprint is given', async () => {
    const { client, calls } = createRecordingClient();

    await recordCirculationDelivery(client as never, {
      accountId: ACCOUNT_ID,
      email: 'dana@example.com',
      sendId: SEND_ID,
      listingIds: [],
      matchPairs: [],
      matchNotes: 'test',
    });

    expect(calls.filter((c) => c.table === PREFERENCES_TABLE)).toHaveLength(0);

    const withFingerprint = createRecordingClient();
    await recordCirculationDelivery(withFingerprint.client as never, {
      accountId: ACCOUNT_ID,
      email: 'dana@example.com',
      sendId: SEND_ID,
      listingIds: [],
      matchPairs: [],
      matchNotes: 'test',
      digestFingerprint: 'a,b',
    });

    expect(
      withFingerprint.calls.find(
        (c) => c.table === PREFERENCES_TABLE && c.op === 'update',
      )?.payload,
    ).toMatchObject({ last_digest_fingerprint: 'a,b' });
  });

  it('reads last-emailed times from the state table, keyed by normalised email', async () => {
    const { client } = createRecordingClient({
      stateRows: [
        {
          email: 'Dana@Example.com',
          last_circulated_at: '2026-09-20T09:00:00Z',
        },
      ],
    });
    const circulation = createCommercialCirculationService(client as never);

    const map = await circulation.listLastCirculatedAt(ACCOUNT_ID, [
      'dana@example.com',
      'new@example.com',
    ]);

    expect(map.get('dana@example.com')).toBe('2026-09-20T09:00:00Z');
    expect(map.has('new@example.com')).toBe(false);
  });
});
