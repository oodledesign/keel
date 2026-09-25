import { describe, expect, it } from 'vitest';

import {
  type DrainRecipient,
  type RecipientClaimPatch,
  claimPatch,
  deliverClaimedRecipients,
} from './campaign-send-drain';

function recipient(
  id: string,
  overrides: Partial<DrainRecipient> = {},
): DrainRecipient {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    preferenceId: null,
    unsubscribeToken: `token-${id}`,
    abVariant: null,
    ...overrides,
  };
}

describe('deliverClaimedRecipients', () => {
  it('backs off a throttled recipient and releases rows that have not started', async () => {
    const persisted: Array<{ id: string; patch: RecipientClaimPatch }> = [];
    let calls = 0;

    const result = await deliverClaimedRecipients({
      recipients: [recipient('a'), recipient('b'), recipient('c')],
      settings: { ratePerSecond: 1000, concurrency: 1 },
      throttleBackoffSeconds: 15,
      now: () => new Date('2026-09-25T12:00:00.000Z'),
      preferenceById: new Map(),
      send: async () => {
        calls += 1;
        if (calls === 2) {
          throw Object.assign(new Error('Maximum sending rate exceeded'), {
            name: 'Throttling',
          });
        }
        return { messageId: `msg-${calls}` };
      },
      persist: async (id, patch) => {
        persisted.push({ id, patch });
        return true;
      },
    });

    expect(result.throttled).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(persisted.map((row) => [row.id, row.patch.kind])).toEqual([
      ['a', 'sent'],
      ['b', 'throttled'],
      ['c', 'release'],
    ]);
    expect(claimPatch(persisted[1]!.patch)).toEqual({
      claim_token: null,
      claim_expires_at: '2026-09-25T12:00:15.000Z',
    });
    expect(claimPatch(persisted[1]!.patch)).not.toHaveProperty('status');
  });

  it('skips opt-outs without calling SES and refunds them as skipped', async () => {
    const sent: string[] = [];
    const result = await deliverClaimedRecipients({
      recipients: [
        recipient('opt-out', {
          preferenceId: 'pref-1',
          unsubscribeToken: null,
        }),
        recipient('missing', { unsubscribeToken: null }),
        recipient('ok'),
      ],
      settings: { ratePerSecond: 1000, concurrency: 2 },
      throttleBackoffSeconds: 15,
      preferenceById: new Map([
        ['pref-1', { marketingStatus: 'unsubscribed', unsubscribeToken: 't' }],
      ]),
      send: async (row) => {
        sent.push(row.id);
        return { messageId: 'm' };
      },
      persist: async () => true,
    });

    expect(sent).toEqual(['ok']);
    expect(result.skipped).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('marks a hard SES failure without treating it as throttle', async () => {
    const patches: RecipientClaimPatch[] = [];
    const result = await deliverClaimedRecipients({
      recipients: [recipient('bad')],
      settings: { ratePerSecond: 10, concurrency: 1 },
      throttleBackoffSeconds: 15,
      preferenceById: new Map(),
      send: async () => {
        throw new Error('Email address is not verified');
      },
      persist: async (_id, patch) => {
        patches.push(patch);
        return true;
      },
    });

    expect(result.failed).toBe(1);
    expect(result.throttled).toBe(false);
    expect(patches[0]).toMatchObject({
      kind: 'failed',
      message: 'Email address is not verified',
    });
    expect(claimPatch(patches[0]!)).toMatchObject({ status: 'failed' });
  });

  it('does not count a send whose claim token no longer matches', async () => {
    const result = await deliverClaimedRecipients({
      recipients: [recipient('lost')],
      settings: { ratePerSecond: 10, concurrency: 1 },
      throttleBackoffSeconds: 15,
      preferenceById: new Map(),
      send: async () => ({ messageId: 'm' }),
      persist: async () => false,
    });

    expect(result.sent).toBe(0);
  });
});
