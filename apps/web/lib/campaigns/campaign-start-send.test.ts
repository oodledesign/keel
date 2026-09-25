import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  debitCampaignCredits,
  getCampaignUsage,
} from '~/lib/campaign-credits/ledger';

import {
  CAMPAIGN_RECIPIENT_INSERT_BATCH,
  createCampaignsService,
} from './campaigns.service';
import { resolveCampaignAudience } from './resolve-campaign-audience';

vi.mock('~/lib/campaign-credits/ledger', () => ({
  debitCampaignCredits: vi.fn(),
  getCampaignUsage: vi.fn(),
  isInsufficientCampaignCreditsError: () => false,
  refundCampaignCredits: vi.fn(),
}));

vi.mock('./resolve-campaign-audience', () => ({
  resolveCampaignAudience: vi.fn(),
}));

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    account_id: ACCOUNT_ID,
    created_by: null,
    name: 'Warm welcome',
    subject: 'Hello',
    subject_b: null,
    ab_enabled: false,
    ab_split_percent: 50,
    preview_text: null,
    html_body: '<p>Hello there</p>',
    body_document: null,
    from_name: 'Ozer',
    from_email: 'hello@example.com',
    reply_to: null,
    audience_type: 'clients',
    audience_config: {},
    status: 'draft',
    scheduled_at: null,
    scheduled_timezone: 'Europe/London',
    sent_at: null,
    audience_count: 0,
    sent_count: 0,
    failed_count: 0,
    skipped_count: 0,
    unsubscribed_count: 0,
    delivered_count: 0,
    open_count: 0,
    click_count: 0,
    bounce_count: 0,
    complaint_count: 0,
    last_error: null,
    series_id: null,
    occurrence_key: null,
    ready: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function recipients(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    email: `person-${index}@example.com`,
    displayName: null,
    clientId: null,
    contactId: null,
    preferenceId: null,
    unsubscribeToken: 'a'.repeat(32),
  }));
}

function createSendClient(options: {
  campaign: Record<string, unknown>;
  onInsert: (
    batch: unknown[],
  ) => Promise<{ error: { message: string } | null }>;
  recipientIdPages?: string[][];
  recipientSelectError?: string;
  existingRecipientEmails?: string[];
}) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const inserts: unknown[][] = [];
  const deletedIds: string[][] = [];
  const idPages = [...(options.recipientIdPages ?? [])];

  const client = {
    from(table: string) {
      const state: {
        payload?: Record<string, unknown>;
        mode?: 'delete' | 'select';
      } = {};
      const builder = {
        select() {
          state.mode = 'select';
          return builder;
        },
        eq() {
          return builder;
        },
        in(_column: string, values: string[]) {
          if (state.mode === 'delete') deletedIds.push(values);
          return builder;
        },
        is() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        range() {
          if (table === 'workspace_email_campaign_recipients') {
            return Promise.resolve({
              data: (options.existingRecipientEmails ?? []).map((email) => ({
                email,
              })),
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
        update(payload: Record<string, unknown>) {
          state.payload = payload;
          updates.push({ table, payload });
          return builder;
        },
        insert(payload: unknown[]) {
          inserts.push(payload);
          return options.onInsert(payload);
        },
        delete() {
          state.mode = 'delete';
          return builder;
        },
        maybeSingle: async () => ({
          data: table === 'workspace_email_campaigns' ? options.campaign : null,
          error: null,
        }),
        then(
          resolve: (value: {
            data: unknown;
            error: { message: string } | null;
            count?: number;
          }) => unknown,
        ) {
          if (
            table === 'workspace_email_campaign_recipients' &&
            state.mode === 'select'
          ) {
            if (options.recipientSelectError) {
              return resolve({
                data: null,
                error: { message: options.recipientSelectError },
              });
            }
            const ids = idPages.shift() ?? [];
            return resolve({
              data: ids.map((id) => ({ id })),
              error: null,
            });
          }

          if (state.payload?.status === 'sending') {
            return resolve({
              data: [{ id: options.campaign.id }],
              error: null,
            });
          }

          return resolve({ data: null, error: null });
        },
      };

      return builder;
    },
  };

  return { client, updates, inserts, deletedIds };
}

describe('CampaignsService.startSend recipient snapshot', () => {
  beforeEach(() => {
    vi.mocked(getCampaignUsage).mockResolvedValue({
      pool: {
        account_id: ACCOUNT_ID,
        balance: 100_000,
        monthly_allowance: 100_000,
        max_contacts: 100_000,
        contact_bonus: 0,
        plan_tier: 'scale',
        cycle_start: null,
        cycle_end: null,
      },
    });
    vi.mocked(debitCampaignCredits).mockReset();
    vi.mocked(resolveCampaignAudience).mockReset();
  });

  it('inserts recipients in batches and debits only after every batch lands', async () => {
    const count = CAMPAIGN_RECIPIENT_INSERT_BATCH + 1;
    vi.mocked(resolveCampaignAudience).mockResolvedValue(
      recipients(count) as never,
    );
    vi.mocked(debitCampaignCredits).mockRejectedValue(new Error('debit down'));

    const { client, updates, inserts, deletedIds } = createSendClient({
      campaign: campaignRow(),
      onInsert: async () => ({ error: null }),
    });

    await expect(
      createCampaignsService(client as never).startSend({
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
        workspaceName: 'Ozer',
      }),
    ).rejects.toThrow('debit down');

    expect(inserts.map((batch) => batch.length)).toEqual([
      CAMPAIGN_RECIPIENT_INSERT_BATCH,
      1,
    ]);
    expect(debitCampaignCredits).toHaveBeenCalledTimes(1);
    expect(debitCampaignCredits).toHaveBeenCalledWith(
      ACCOUNT_ID,
      count,
      CAMPAIGN_ID,
    );
    expect(updates.map((update) => update.payload.status)).toEqual([
      'sending',
      'draft',
    ]);
    expect(deletedIds).toEqual([]);
  });

  it('marks the campaign failed, drops the partial snapshot, and does not debit when a later batch fails', async () => {
    const count = CAMPAIGN_RECIPIENT_INSERT_BATCH + 1;
    vi.mocked(resolveCampaignAudience).mockResolvedValue(
      recipients(count) as never,
    );

    const { client, updates, inserts, deletedIds } = createSendClient({
      campaign: campaignRow(),
      recipientIdPages: [['recipient-1']],
      onInsert: async (batch) =>
        batch.length === 1
          ? { error: { message: 'payload too large' } }
          : { error: null },
    });

    await expect(
      createCampaignsService(client as never).startSend({
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
        workspaceName: 'Ozer',
      }),
    ).rejects.toThrow('payload too large');

    expect(inserts).toHaveLength(2);
    expect(debitCampaignCredits).not.toHaveBeenCalled();
    expect(updates.map((update) => update.payload)).toEqual([
      expect.objectContaining({
        status: 'sending',
        audience_count: count,
      }),
      expect.objectContaining({
        status: 'failed',
        last_error: 'payload too large',
      }),
    ]);
    expect(deletedIds).toEqual([['recipient-1']]);
  });

  it('stays failed when rolling back the partial snapshot fails', async () => {
    vi.mocked(resolveCampaignAudience).mockResolvedValue(
      recipients(1) as never,
    );

    const { client, updates } = createSendClient({
      campaign: campaignRow(),
      recipientSelectError: 'could not list recipient ids',
      onInsert: async () => ({ error: { message: 'insert failed' } }),
    });

    await expect(
      createCampaignsService(client as never).startSend({
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
        workspaceName: 'Ozer',
      }),
    ).rejects.toThrow('insert failed');

    expect(debitCampaignCredits).not.toHaveBeenCalled();
    expect(updates.map((update) => update.payload.status)).toEqual([
      'sending',
      'failed',
      'failed',
    ]);
    expect(updates.at(-1)?.payload.last_error).toContain(
      'could not list recipient ids',
    );
  });

  it('debits an existing full snapshot without inserting or deleting it', async () => {
    const count = 3;
    vi.mocked(resolveCampaignAudience).mockResolvedValue(
      recipients(count) as never,
    );
    vi.mocked(debitCampaignCredits).mockRejectedValue(new Error('debit down'));

    const audience = recipients(count);
    const { client, inserts, deletedIds, updates } = createSendClient({
      campaign: campaignRow(),
      existingRecipientEmails: audience.map((recipient) => recipient.email),
      onInsert: async () => {
        throw new Error('snapshot already exists');
      },
    });

    await expect(
      createCampaignsService(client as never).startSend({
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
        workspaceName: 'Ozer',
      }),
    ).rejects.toThrow('debit down');

    expect(inserts).toEqual([]);
    expect(deletedIds).toEqual([]);
    expect(debitCampaignCredits).toHaveBeenCalledWith(
      ACCOUNT_ID,
      count,
      CAMPAIGN_ID,
    );
    expect(updates.map((update) => update.payload.status)).toEqual([
      'sending',
      'draft',
    ]);
  });

  it('replaces a same-sized snapshot when the audience emails differ', async () => {
    const audience = recipients(3);
    vi.mocked(resolveCampaignAudience).mockResolvedValue(audience as never);
    vi.mocked(debitCampaignCredits).mockRejectedValue(new Error('debit down'));

    const { client, inserts, deletedIds } = createSendClient({
      campaign: campaignRow(),
      existingRecipientEmails: [
        'person-0@example.com',
        'person-1@example.com',
        'other@example.com',
      ],
      recipientIdPages: [['old-recipient']],
      onInsert: async () => ({ error: null }),
    });

    await expect(
      createCampaignsService(client as never).startSend({
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
        workspaceName: 'Ozer',
      }),
    ).rejects.toThrow('debit down');

    expect(deletedIds).toEqual([['old-recipient']]);
    expect(inserts.map((batch) => batch.length)).toEqual([3]);
    expect(debitCampaignCredits).toHaveBeenCalledWith(
      ACCOUNT_ID,
      3,
      CAMPAIGN_ID,
    );
  });
});

describe('CampaignsService.processPending incomplete snapshot', () => {
  it('does not send while inserted recipients are still short of the claimed audience', async () => {
    const client = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          maybeSingle: async () => ({
            data: campaignRow({ status: 'sending', audience_count: 1000 }),
            error: null,
          }),
          then(resolve: (value: { count: number; error: null }) => unknown) {
            return resolve({ count: 400, error: null });
          },
        };
        return builder;
      },
    };

    const result = await createCampaignsService(client as never).processPending(
      {
        accountId: ACCOUNT_ID,
        campaignId: CAMPAIGN_ID,
      },
    );

    expect(result.remaining).toBe(600);
    expect(result.lockAcquired).toBe(false);
    expect(result.campaign).toEqual(
      expect.objectContaining({
        status: 'sending',
        audienceCount: 1000,
      }),
    );
  });
});
