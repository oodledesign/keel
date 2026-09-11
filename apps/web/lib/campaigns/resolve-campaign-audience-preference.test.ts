import { describe, expect, it, vi } from 'vitest';

import { WORKSPACE_MAILING_LAWFUL_BASES } from '~/lib/workspace-forms/workspace-mailing-list';

import { CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN } from './campaign-test-send';
import {
  lookupCampaignRecipientByToken,
  resubscribeCampaignRecipientByToken,
  unsubscribeCampaignRecipientByToken,
} from './resolve-campaign-audience';

const TOKEN = 'b'.repeat(32);
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function createCampaignClient(options: {
  recipient?: Record<string, unknown> | null;
  preference?: Record<string, unknown> | null;
}) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];

  const client = {
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      Object.assign(query, {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        limit: vi.fn(() => query),
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push({ table, payload });
          return query;
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserts.push({ table, payload });
          return query;
        }),
        maybeSingle: vi.fn(async () => ({
          data:
            table === 'workspace_email_campaign_recipients'
              ? (options.recipient ?? null)
              : (options.preference ?? null),
          error: null,
        })),
        then: (resolve: (value: { error: null }) => unknown) =>
          resolve({ error: null }),
      });
      return query;
    }),
  };

  return { client, updates, inserts };
}

describe('campaign recipient unsubscribe tokens', () => {
  it('leaves campaign-test-preview invalid', async () => {
    const { client } = createCampaignClient({});

    await expect(
      lookupCampaignRecipientByToken(
        client as never,
        CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
      ),
    ).resolves.toBeNull();
    await expect(
      unsubscribeCampaignRecipientByToken(
        client as never,
        CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
      ),
    ).resolves.toBeNull();
    await expect(
      resubscribeCampaignRecipientByToken(
        client as never,
        CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
      ),
    ).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('looks up a recipient token and restores the preference row', async () => {
    const recipient = {
      id: 'rec-1',
      account_id: ACCOUNT_ID,
      email: 'Dana@Example.com',
    };
    const preference = {
      id: 'pref-1',
      marketing_status: 'unsubscribed',
    };

    const lookup = createCampaignClient({ recipient, preference });
    await expect(
      lookupCampaignRecipientByToken(lookup.client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dana@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });

    const resub = createCampaignClient({ recipient, preference });
    await expect(
      resubscribeCampaignRecipientByToken(resub.client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dana@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });
    expect(resub.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'workspace_mailing_preferences',
          payload: expect.objectContaining({
            marketing_status: 'subscribed',
            unsubscribed_at: null,
          }),
        }),
      ]),
    );
  });

  it('does not overwrite a suppressed preference on campaign unsubscribe', async () => {
    const { client, updates } = createCampaignClient({
      recipient: {
        id: 'rec-1',
        account_id: ACCOUNT_ID,
        email: 'dana@example.com',
      },
      preference: {
        id: 'pref-1',
        marketing_status: 'suppressed',
      },
    });

    await expect(
      unsubscribeCampaignRecipientByToken(client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dana@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'workspace_email_campaign_recipients',
        }),
      ]),
    );
    expect(updates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'workspace_mailing_preferences',
        }),
      ]),
    );
  });

  it('creates an unsubscribed preference when a historic campaign token has none', async () => {
    const { client, inserts } = createCampaignClient({
      recipient: {
        id: 'rec-1',
        account_id: ACCOUNT_ID,
        email: 'dana@example.com',
      },
      preference: null,
    });

    await expect(
      unsubscribeCampaignRecipientByToken(client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dana@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });
    expect(inserts[0]).toMatchObject({
      table: 'workspace_mailing_preferences',
      payload: {
        marketing_status: 'unsubscribed',
        lawful_basis: 'imported_historical',
        consent_source: 'campaign_unsubscribe',
        consent_copy_version: 'v1',
        unsubscribe_token: TOKEN,
      },
    });
    expect(WORKSPACE_MAILING_LAWFUL_BASES).toContain(
      inserts[0]?.payload.lawful_basis,
    );
  });

  it('creates a subscribed preference when a campaign token has none', async () => {
    const { client, inserts } = createCampaignClient({
      recipient: {
        id: 'rec-1',
        account_id: ACCOUNT_ID,
        email: 'dana@example.com',
      },
      preference: null,
    });

    await expect(
      resubscribeCampaignRecipientByToken(client as never, TOKEN),
    ).resolves.toEqual({
      email: 'dana@example.com',
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });
    expect(inserts[0]).toMatchObject({
      table: 'workspace_mailing_preferences',
      payload: {
        marketing_status: 'subscribed',
        lawful_basis: 'manual_opt_in',
        consent_source: 'unsubscribe_page_resubscribe',
        unsubscribe_token: TOKEN,
      },
    });
    expect(WORKSPACE_MAILING_LAWFUL_BASES).toContain(
      inserts[0]?.payload.lawful_basis,
    );
  });
});
