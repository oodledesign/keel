import { describe, expect, it, vi } from 'vitest';

import { CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN } from '~/lib/campaigns/campaign-test-send';

import {
  lookupWorkspaceMailingListByToken,
  resubscribeWorkspaceMailingListByToken,
  unsubscribeWorkspaceMailingListByToken,
} from './workspace-mailing-list';

const TOKEN = 'a'.repeat(32);
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function createPreferenceClient(options: {
  row?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
}) {
  const updates: Array<Record<string, unknown>> = [];

  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
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

  return {
    updates,
    client: {
      from: vi.fn(() => query),
    },
  };
}

describe('workspace mailing list preference tokens', () => {
  it('ignores test-preview and short tokens', async () => {
    const { client } = createPreferenceClient({ row: null });

    await expect(
      lookupWorkspaceMailingListByToken(
        client as never,
        CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
      ),
    ).resolves.toBeNull();
    await expect(
      unsubscribeWorkspaceMailingListByToken(
        client as never,
        CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
      ),
    ).resolves.toBeNull();
    await expect(
      resubscribeWorkspaceMailingListByToken(client as never, 'short'),
    ).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('unsubscribes a preference row and resubscribes it', async () => {
    const unsub = createPreferenceClient({
      row: {
        id: 'pref-1',
        account_id: ACCOUNT_ID,
        email: 'dan@example.com',
        marketing_status: 'subscribed',
      },
    });

    await expect(
      unsubscribeWorkspaceMailingListByToken(unsub.client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dan@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });
    expect(unsub.updates[0]).toMatchObject({
      marketing_status: 'unsubscribed',
    });

    const resub = createPreferenceClient({
      row: {
        id: 'pref-1',
        account_id: ACCOUNT_ID,
        email: 'dan@example.com',
        marketing_status: 'unsubscribed',
      },
    });
    await expect(
      resubscribeWorkspaceMailingListByToken(resub.client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dan@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });
    expect(resub.updates[0]).toMatchObject({
      marketing_status: 'subscribed',
      unsubscribed_at: null,
      consent_source: 'unsubscribe_page_resubscribe',
    });
  });

  it('does not overwrite a suppressed preference on unsubscribe', async () => {
    const { client, updates } = createPreferenceClient({
      row: {
        id: 'pref-1',
        account_id: ACCOUNT_ID,
        email: 'dan@example.com',
        marketing_status: 'suppressed',
      },
    });

    await expect(
      unsubscribeWorkspaceMailingListByToken(client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dan@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });
    expect(updates).toHaveLength(0);
  });

  it('does not flip a suppressed preference back to subscribed', async () => {
    const { client, updates } = createPreferenceClient({
      row: {
        id: 'pref-1',
        account_id: ACCOUNT_ID,
        email: 'dan@example.com',
        marketing_status: 'suppressed',
      },
    });

    await expect(
      resubscribeWorkspaceMailingListByToken(client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dan@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });
    expect(updates).toHaveLength(0);
  });
});
