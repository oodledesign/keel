import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomUUID } from 'node:crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  debitCampaignCredits,
  getCampaignUsage,
  isInsufficientCampaignCreditsError,
  refundCampaignCredits,
} from '~/lib/campaign-credits/ledger';
import {
  assignCampaignAbVariant,
  clampAbSplitPercent,
  subjectForAbVariant,
} from '~/lib/campaigns/campaign-ab';
import {
  campaignDocumentHasContent,
  parseCampaignDocument,
  resolveCampaignDocument,
} from '~/lib/campaigns/campaign-document';
import { CampaignQuotaError } from '~/lib/campaigns/campaign-quota-error';
import {
  CAMPAIGN_TEST_MAX_RECIPIENTS,
  CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
  campaignTestSubject,
  normalizeCampaignTestEmails,
} from '~/lib/campaigns/campaign-test-send';
import { parseCampaignTimezone } from '~/lib/campaigns/campaign-timezone';
import { describeCampaignQuota } from '~/lib/campaigns/campaign-usage';
import { compileCampaignDocument } from '~/lib/campaigns/compile-campaign-document';
import { formUrlForMerge } from '~/lib/campaigns/form-link';
import {
  applyCampaignMergeText,
  mergeValuesForRecipient,
} from '~/lib/campaigns/merge-fields';
import {
  compileCampaignHtmlShell,
  personalizeCampaignHtml,
  renderCampaignHtml,
} from '~/lib/campaigns/render-campaign-html';
import { resolveCampaignReplyTo } from '~/lib/campaigns/resolve-campaign-reply-to';
import { sendCampaignEmailViaSes } from '~/lib/campaigns/send-campaign-email';
import {
  SendingDomainError,
  emailDomainOf,
  getPlatformSesFrom,
  isSendingDomainVerified,
  loadAccountSendingDomain,
  normalizeSendingLocalPart,
  resolveSendingHost,
  resolveWorkspaceMailFrom,
} from '~/lib/sending-domains/server';
import { buildWorkspaceMailingListUnsubscribeUrl } from '~/lib/workspace-forms/workspace-mailing-list';

import {
  CAMPAIGN_AUDIENCE_LIST_REQUIRED,
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  campaignAudienceListMissing,
  parseCampaignAudienceConfig,
  parseCampaignAudienceType,
} from './campaign-audience';
import { assertCampaignDeletable } from './campaign-delete';
import {
  additionalRecipientsCampaignName,
  duplicateCampaignName,
  filterAdditionalRecipients,
} from './campaign-duplicate';
import {
  followUpAudienceEmails,
  followUpCampaignName,
  uniqueRecipientEmails,
} from './campaign-resend';
import {
  type DrainRecipient,
  type MailingPreferenceSnapshot,
  type RecipientClaimPatch,
  claimPatch,
  deliverClaimedRecipients,
} from './campaign-send-drain';
import {
  type CampaignSendProgressSnapshot,
  buildCampaignSendProgress,
} from './campaign-send-progress';
import {
  campaignSendWaveSize,
  kickCampaignSendContinuation,
  readCampaignSendSettings,
  shouldContinueCampaignSend,
} from './campaign-send-worker';
import { seriesInstanceMaySend } from './campaign-series-ready';
import { generateMissingSeriesInstances } from './campaign-series.service';
import type {
  EmailCampaign,
  EmailCampaignRecipient,
  EmailCampaignStatus,
} from './campaign.types';
import { CAMPAIGN_AUDIENCE_IN_CHUNK, fetchAllPagedRows } from './page-query';
import {
  type ResolvedCampaignRecipient,
  resolveCampaignAudience,
} from './resolve-campaign-audience';

export type {
  EmailCampaign,
  EmailCampaignRecipient,
  EmailCampaignStatus,
} from './campaign.types';

/** Add-on tables. Distinct from admin marketing `email_campaigns`. */
const WORKSPACE_EMAIL_CAMPAIGNS = 'workspace_email_campaigns';
const WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS =
  'workspace_email_campaign_recipients';

/**
 * Rows per recipient insert. A single PostgREST insert of ~30k rows fails on
 * payload size or statement timeout before any mail goes out. A few hundred
 * to ~1k stays under that limit.
 */
export const CAMPAIGN_RECIPIENT_INSERT_BATCH = 500;

/** Send-log rows rendered on the campaign detail page. */
export const CAMPAIGN_RECIPIENT_LOG_LIMIT = 100;

/** Hub / picker rows — skip compiled html_body (often large). */
const CAMPAIGN_LIST_COLUMNS = [
  'id',
  'account_id',
  'created_by',
  'name',
  'subject',
  'subject_b',
  'ab_enabled',
  'ab_split_percent',
  'preview_text',
  'body_document',
  'from_name',
  'from_email',
  'reply_to',
  'audience_type',
  'audience_config',
  'status',
  'scheduled_at',
  'scheduled_timezone',
  'sent_at',
  'audience_count',
  'sent_count',
  'failed_count',
  'skipped_count',
  'unsubscribed_count',
  'delivered_count',
  'open_count',
  'click_count',
  'bounce_count',
  'complaint_count',
  'last_error',
  'series_id',
  'occurrence_key',
  'ready',
  'created_at',
  'updated_at',
].join(',');

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

/**
 * Delete recipient rows for one campaign in batches. Used to drop a partial
 * or stale snapshot before credits are debited.
 */
async function deleteCampaignRecipientSnapshot(
  client: SupabaseClient,
  accountId: string,
  campaignId: string,
) {
  for (;;) {
    const { data, error } = await fromTable(
      client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .limit(CAMPAIGN_RECIPIENT_INSERT_BATCH);

    if (error) throw new Error(error.message);

    const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) return;

    const { error: deleteError } = await fromTable(
      client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .delete()
      .in('id', ids)
      .eq('account_id', accountId);

    if (deleteError) throw new Error(deleteError.message);
    if (ids.length < CAMPAIGN_RECIPIENT_INSERT_BATCH) return;
  }
}

async function listSnapshotEmails(
  client: SupabaseClient,
  accountId: string,
  campaignId: string,
): Promise<string[]> {
  const rows = await fetchAllPagedRows<{ email: string }>(async (from, to) =>
    fromTable(client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
      .select('email')
      .eq('campaign_id', campaignId)
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .range(from, to),
  );

  return rows.map((row) => row.email);
}

function sameRecipientSnapshot(
  existingEmails: readonly string[],
  recipients: readonly ResolvedCampaignRecipient[],
) {
  if (existingEmails.length !== recipients.length) return false;
  const wanted = new Set(recipients.map((recipient) => recipient.email));
  if (wanted.size !== existingEmails.length) return false;
  return existingEmails.every((email) => wanted.has(email));
}

function callCampaignRpc(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  return (
    client as unknown as {
      rpc: (
        name: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc(fn, args);
}

async function claimCampaignRecipientWave(
  client: SupabaseClient,
  input: {
    accountId: string;
    campaignId: string;
    limit: number;
    leaseSeconds: number;
  },
): Promise<{ claimToken: string; recipients: DrainRecipient[] }> {
  const claimToken = randomUUID();
  const { data, error } = await callCampaignRpc(
    client,
    'claim_campaign_recipients',
    {
      p_campaign_id: input.campaignId,
      p_account_id: input.accountId,
      p_limit: input.limit,
      p_lease_seconds: input.leaseSeconds,
      p_claim_token: claimToken,
    },
  );
  if (error) throw new Error(error.message);

  const recipients = (Array.isArray(data) ? data : []).map((row) => {
    const record = row as Record<string, unknown>;
    const variant = record.recipient_ab_variant;
    return {
      id: String(record.recipient_id),
      email: String(record.recipient_email),
      displayName: (record.recipient_display_name as string | null) ?? null,
      preferenceId: (record.recipient_preference_id as string | null) ?? null,
      unsubscribeToken:
        (record.recipient_unsubscribe_token as string | null) ?? null,
      abVariant: variant === 'a' || variant === 'b' ? variant : null,
    } satisfies DrainRecipient;
  });

  return { claimToken, recipients };
}

async function loadMailingPreferences(
  client: SupabaseClient,
  accountId: string,
  ids: string[],
): Promise<Map<string, MailingPreferenceSnapshot>> {
  const map = new Map<string, MailingPreferenceSnapshot>();
  for (
    let offset = 0;
    offset < ids.length;
    offset += CAMPAIGN_AUDIENCE_IN_CHUNK
  ) {
    const chunk = ids.slice(offset, offset + CAMPAIGN_AUDIENCE_IN_CHUNK);
    const { data, error } = await fromTable(
      client,
      'workspace_mailing_preferences',
    )
      .select('id, marketing_status, unsubscribe_token')
      .eq('account_id', accountId)
      .in('id', chunk);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as Array<{
      id: string;
      marketing_status?: string | null;
      unsubscribe_token?: string | null;
    }>) {
      map.set(row.id, {
        marketingStatus: row.marketing_status,
        unsubscribeToken: row.unsubscribe_token,
      });
    }
  }
  return map;
}

async function persistRecipientClaim(
  client: SupabaseClient,
  recipientId: string,
  claimToken: string,
  patch: RecipientClaimPatch,
): Promise<boolean> {
  const { data, error } = await fromTable(
    client,
    WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
  )
    .update(claimPatch(patch))
    .eq('id', recipientId)
    .eq('claim_token', claimToken)
    .eq('status', 'pending')
    .select('id');

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

async function campaignRecipientStatusCounts(
  client: SupabaseClient,
  accountId: string,
  campaignId: string,
): Promise<{
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  unsubscribed: number;
}> {
  const { data, error } = await callCampaignRpc(
    client,
    'campaign_recipient_status_counts',
    {
      p_campaign_id: campaignId,
      p_account_id: accountId,
    },
  );
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;
  const count = (key: string) => Number(row?.[key] ?? 0);
  return {
    pending: count('pending_count'),
    sent: count('sent_count'),
    failed: count('failed_count'),
    skipped: count('skipped_count'),
    unsubscribed: count('unsubscribed_count'),
  };
}

function mapCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    subject: String(row.subject ?? ''),
    subjectB: (row.subject_b as string | null) ?? null,
    abEnabled: Boolean(row.ab_enabled),
    abSplitPercent: clampAbSplitPercent(Number(row.ab_split_percent ?? 50)),
    previewText: (row.preview_text as string | null) ?? null,
    // list() omits html_body — only get() / send paths populate this.
    htmlBody: String(row.html_body ?? ''),
    bodyDocument: parseCampaignDocument(row.body_document),
    fromName: (row.from_name as string | null) ?? null,
    fromEmail: (row.from_email as string | null) ?? null,
    replyTo: (row.reply_to as string | null) ?? null,
    audienceType: parseCampaignAudienceType(row.audience_type),
    audienceConfig: parseCampaignAudienceConfig(row.audience_config),
    status: row.status as EmailCampaignStatus,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    scheduledTimezone: parseCampaignTimezone(row.scheduled_timezone),
    sentAt: (row.sent_at as string | null) ?? null,
    audienceCount: Number(row.audience_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    unsubscribedCount: Number(row.unsubscribed_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    openCount: Number(row.open_count ?? 0),
    clickCount: Number(row.click_count ?? 0),
    bounceCount: Number(row.bounce_count ?? 0),
    complaintCount: Number(row.complaint_count ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    seriesId: (row.series_id as string | null) ?? null,
    occurrenceKey: (row.occurrence_key as string | null) ?? null,
    ready: row.ready !== false,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createCampaignsService(client: SupabaseClient) {
  return new CampaignsService(client);
}

class CampaignsService {
  constructor(private readonly client: SupabaseClient) {}

  async list(
    accountId: string,
    options?: { includeSeriesInstances?: boolean },
  ): Promise<EmailCampaign[]> {
    let query = fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
      // Omit html_body — hub cards use a CSS miniature + body_document hints.
      .select(CAMPAIGN_LIST_COLUMNS)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (!options?.includeSeriesInstances) {
      query = query.is('series_id', null);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapCampaign);
  }

  async get(accountId: string, campaignId: string): Promise<EmailCampaign> {
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .select('*')
      .eq('account_id', accountId)
      .eq('id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Campaign not found');
    return mapCampaign(data as Record<string, unknown>);
  }

  async create(input: {
    accountId: string;
    userId: string;
    name: string;
    subject?: string;
    previewText?: string | null;
    htmlBody?: string;
    bodyDocument?: unknown;
  }): Promise<EmailCampaign> {
    const brand = await loadAccountBrandResolved(input.accountId);
    const document = resolveCampaignDocument(
      input.bodyDocument,
      input.htmlBody ?? '',
      brand,
    );
    const htmlBody = compileCampaignDocument(document, brand);

    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name: input.name.trim(),
        subject: input.subject?.trim() ?? '',
        preview_text: input.previewText?.trim() || null,
        html_body: htmlBody,
        body_document: document,
        status: 'draft',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create campaign');
    }

    return mapCampaign(data as Record<string, unknown>);
  }

  /**
   * New draft copied from a sent campaign. Does not mutate the historical send.
   * Recurring occurrences become a one-off follow-up (no series_id).
   */
  async duplicateForResend(input: {
    accountId: string;
    userId: string;
    campaignId: string;
    mode: 'all' | 'non_responders';
    responderEmails?: string[];
  }): Promise<EmailCampaign> {
    const source = await this.get(input.accountId, input.campaignId);
    if (source.status !== 'sent' && source.status !== 'failed') {
      throw new Error('Only sent or failed campaigns can be sent again');
    }

    const recipients = await this.listRecipientIdentityRows(
      input.accountId,
      input.campaignId,
    );
    const emails = followUpAudienceEmails({
      mode: input.mode,
      recipients,
      responderEmails: (input.responderEmails ?? []).map((email) => ({
        contactEmail: email,
      })),
    });

    if (input.mode === 'non_responders' && emails.length === 0) {
      throw new Error('Everyone invited has already responded');
    }
    if (emails.length > 5000) {
      throw new Error('Too many people for a follow-up list (max 5,000).');
    }

    // Snapshot the original send when we have recipient rows. If the send
    // never produced rows, keep the source audience (list / subscribers).
    const audienceType = emails.length > 0 ? 'custom' : source.audienceType;
    const audienceConfig =
      emails.length > 0
        ? {
            emails,
            clientIds: [],
            contactIds: [],
            listId: null,
          }
        : source.audienceConfig;

    return this.insertCopiedDraft({
      accountId: input.accountId,
      userId: input.userId,
      source,
      name: followUpCampaignName(source.name),
      audienceType,
      audienceConfig,
      failureMessage: 'Could not create follow-up campaign',
    });
  }

  /**
   * New draft with the same copy and audience settings. Send history, schedule,
   * and series membership stay on the source — the clone is a one-off draft.
   */
  async duplicate(input: {
    accountId: string;
    userId: string;
    campaignId: string;
  }): Promise<EmailCampaign> {
    const source = await this.get(input.accountId, input.campaignId);
    return this.insertCopiedDraft({
      accountId: input.accountId,
      userId: input.userId,
      source,
      name: duplicateCampaignName(source.name),
      audienceType: source.audienceType,
      audienceConfig: source.audienceConfig,
      failureMessage: 'Could not duplicate campaign',
    });
  }

  /**
   * New draft using the sent campaign's copy, aimed only at people who were
   * not on that send. Never copies subscribers / saved-list audience, so it
   * cannot re-blast the original list.
   */
  async duplicateForAdditionalRecipients(input: {
    accountId: string;
    userId: string;
    campaignId: string;
    emails: string[];
    clientIds: string[];
    contactIds: string[];
  }): Promise<{ campaign: EmailCampaign; skippedAlreadySent: number }> {
    const source = await this.get(input.accountId, input.campaignId);
    if (source.status !== 'sent' && source.status !== 'failed') {
      throw new Error(
        'Only sent campaigns can be emailed to additional recipients',
      );
    }

    const recipients = await this.listRecipientIdentityRows(
      input.accountId,
      input.campaignId,
      'sent',
    );
    const [clients, contacts] = await Promise.all([
      this.peopleEmails('clients', input.accountId, input.clientIds),
      this.peopleEmails('contacts', input.accountId, input.contactIds),
    ]);
    // Only successful sends are left off. Failed or skipped rows can be
    // picked again; unsubscribes are still dropped at send time.
    const filtered = filterAdditionalRecipients({
      emails: input.emails,
      selectedClientIds: input.clientIds,
      selectedContactIds: input.contactIds,
      clients,
      contacts,
      alreadySentEmails: uniqueRecipientEmails(
        recipients.filter((row) => row.status === 'sent'),
      ),
    });
    const remaining =
      filtered.emails.length +
      filtered.clientIds.length +
      filtered.contactIds.length;

    if (remaining === 0) {
      if (filtered.skippedAlreadySent > 0) {
        throw new Error(
          'Those people were already sent this campaign. Add someone new, or use Send again to all.',
        );
      }
      throw new Error('Add at least one recipient.');
    }
    if (filtered.emails.length > 5000) {
      throw new Error('Too many people for a follow-up list (max 5,000).');
    }

    const campaign = await this.insertCopiedDraft({
      accountId: input.accountId,
      userId: input.userId,
      source,
      name: additionalRecipientsCampaignName(source.name),
      audienceType: 'custom',
      audienceConfig: {
        emails: filtered.emails,
        clientIds: filtered.clientIds,
        contactIds: filtered.contactIds,
        listId: null,
      },
      failureMessage: 'Could not create the additional-recipients draft',
    });

    return { campaign, skippedAlreadySent: filtered.skippedAlreadySent };
  }

  private async peopleEmails(
    table: 'clients' | 'contacts',
    accountId: string,
    ids: string[],
  ): Promise<Array<{ id: string; email: string }>> {
    if (ids.length === 0) return [];

    let query = fromTable(this.client, table)
      .select('id, email')
      .eq('account_id', accountId)
      .in('id', ids)
      .not('email', 'is', null);

    // Clients can be archived. Contacts have no archived_at column.
    if (table === 'clients') {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: String(row.id),
        email: String(row.email ?? ''),
      }))
      .filter((row) => row.email.trim().length > 0);
  }

  private async insertCopiedDraft(input: {
    accountId: string;
    userId: string;
    source: EmailCampaign;
    name: string;
    audienceType: CampaignAudienceType;
    audienceConfig: CampaignAudienceConfig;
    failureMessage: string;
  }): Promise<EmailCampaign> {
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name: input.name,
        subject: input.source.subject,
        subject_b: input.source.subjectB,
        ab_enabled: input.source.abEnabled,
        ab_split_percent: input.source.abSplitPercent,
        preview_text: input.source.previewText,
        html_body: input.source.htmlBody,
        body_document: input.source.bodyDocument,
        from_name: input.source.fromName,
        from_email: input.source.fromEmail,
        reply_to: input.source.replyTo,
        audience_type: input.audienceType,
        audience_config: input.audienceConfig,
        scheduled_timezone: input.source.scheduledTimezone,
        status: 'draft',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? input.failureMessage);
    }

    return mapCampaign(data as Record<string, unknown>);
  }

  async update(input: {
    accountId: string;
    campaignId: string;
    name?: string;
    subject?: string;
    previewText?: string | null;
    htmlBody?: string;
    bodyDocument?: unknown;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    audienceType?: CampaignAudienceType;
    audienceConfig?: CampaignAudienceConfig;
    scheduledAt?: string | null;
    scheduledTimezone?: string | null;
    subjectB?: string | null;
    abEnabled?: boolean;
    abSplitPercent?: number;
  }): Promise<EmailCampaign> {
    const existing = await this.get(input.accountId, input.campaignId);
    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      throw new Error('Only draft or scheduled campaigns can be edited');
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.subject !== undefined) patch.subject = input.subject.trim();
    if (input.subjectB !== undefined) {
      patch.subject_b = input.subjectB?.trim() || null;
    }
    if (input.abEnabled !== undefined) patch.ab_enabled = input.abEnabled;
    if (input.abSplitPercent !== undefined) {
      patch.ab_split_percent = clampAbSplitPercent(input.abSplitPercent);
    }
    if (input.scheduledTimezone !== undefined) {
      patch.scheduled_timezone = parseCampaignTimezone(input.scheduledTimezone);
    }
    if (input.previewText !== undefined) {
      patch.preview_text = input.previewText?.trim() || null;
    }
    if (input.bodyDocument !== undefined || input.htmlBody !== undefined) {
      const brand = await loadAccountBrandResolved(input.accountId);
      const document = resolveCampaignDocument(
        input.bodyDocument ?? existing.bodyDocument,
        input.htmlBody ?? existing.htmlBody,
        brand,
      );
      patch.body_document = document;
      patch.html_body = compileCampaignDocument(document, brand);
    }

    if (
      input.fromName !== undefined ||
      input.fromEmail !== undefined ||
      input.replyTo !== undefined
    ) {
      const sendingDomain = await loadAccountSendingDomain(
        this.client,
        input.accountId,
      );
      const verified =
        sendingDomain != null && isSendingDomainVerified(sendingDomain);

      if (input.fromName !== undefined) {
        patch.from_name = input.fromName?.trim() || null;
      }

      if (input.fromEmail !== undefined) {
        const raw = input.fromEmail?.trim().toLowerCase() || null;
        if (!raw) {
          patch.from_email = null;
        } else if (!verified || !sendingDomain) {
          throw new Error(
            'Connect and verify a sending domain before choosing a custom From address.',
          );
        } else {
          const host = resolveSendingHost(
            sendingDomain.domain,
            sendingDomain.sending_subdomain,
          );
          if (emailDomainOf(raw) !== host) {
            throw new Error(
              `From address must use the verified sending host @${host}.`,
            );
          }
          const local = raw.slice(0, raw.lastIndexOf('@'));
          try {
            normalizeSendingLocalPart(local);
          } catch (error) {
            throw new Error(
              error instanceof SendingDomainError
                ? error.message
                : 'Invalid From local-part',
            );
          }
          patch.from_email = `${local}@${host}`;
        }
      }

      if (input.replyTo !== undefined) {
        const reply = input.replyTo?.trim() || null;
        if (reply && !reply.includes('@')) {
          throw new Error('Reply-To must be a valid email address.');
        }
        patch.reply_to = reply;
      }
    }

    if (input.audienceType !== undefined) {
      patch.audience_type = parseCampaignAudienceType(input.audienceType);
    }
    if (input.audienceConfig !== undefined) {
      patch.audience_config = parseCampaignAudienceConfig(input.audienceConfig);
    }
    if (input.scheduledAt !== undefined) {
      if (input.scheduledAt === null || input.scheduledAt === '') {
        patch.scheduled_at = null;
        if (existing.status === 'scheduled') {
          patch.status = 'draft';
        }
      } else {
        const when = new Date(input.scheduledAt);
        if (Number.isNaN(when.getTime())) {
          throw new Error('Invalid schedule time');
        }
        // Allow clearing via empty; future dates validated on schedule action.
        patch.scheduled_at = when.toISOString();
      }
    }

    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update(patch)
      .eq('id', input.campaignId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not update campaign');
    }

    return mapCampaign(data as Record<string, unknown>);
  }

  async listRecipients(
    accountId: string,
    campaignId: string,
    options?: { limit?: number },
  ): Promise<EmailCampaignRecipient[]> {
    const limit = Math.max(1, options?.limit ?? CAMPAIGN_RECIPIENT_LOG_LIMIT);
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select(
        'id, campaign_id, email, display_name, status, skip_reason, error_message, ses_message_id, sent_at, unsubscribed_at, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, bounce_subtype, complaint_at, ab_variant',
      )
      .eq('account_id', accountId)
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id),
      email: String(row.email),
      displayName: (row.display_name as string | null) ?? null,
      status: row.status as EmailCampaignRecipient['status'],
      skipReason: (row.skip_reason as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      sesMessageId: (row.ses_message_id as string | null) ?? null,
      sentAt: (row.sent_at as string | null) ?? null,
      unsubscribedAt: (row.unsubscribed_at as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      openedAt: (row.opened_at as string | null) ?? null,
      openCount: Number(row.open_count ?? 0),
      clickedAt: (row.clicked_at as string | null) ?? null,
      clickCount: Number(row.click_count ?? 0),
      bouncedAt: (row.bounced_at as string | null) ?? null,
      bounceType: (row.bounce_type as string | null) ?? null,
      bounceSubtype: (row.bounce_subtype as string | null) ?? null,
      complaintAt: (row.complaint_at as string | null) ?? null,
      abVariant:
        row.ab_variant === 'a' || row.ab_variant === 'b'
          ? row.ab_variant
          : null,
    }));
  }

  /**
   * Every recipient email for follow-up drafts. Paged so a 30k send is not
   * truncated at PostgREST max_rows.
   */
  async listRecipientIdentityRows(
    accountId: string,
    campaignId: string,
    status?: EmailCampaignRecipient['status'],
  ): Promise<
    Array<{ email: string; status: EmailCampaignRecipient['status'] }>
  > {
    const rows = await fetchAllPagedRows<{
      email: string;
      status: EmailCampaignRecipient['status'];
    }>(async (from, to) => {
      let query = fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
        .select('email, status')
        .eq('account_id', accountId)
        .eq('campaign_id', campaignId)
        .order('id', { ascending: true });
      if (status) {
        query = query.eq('status', status);
      }
      return query.range(from, to);
    });

    return rows.map((row) => ({
      email: String(row.email),
      status: row.status,
    }));
  }

  async countRecipients(
    accountId: string,
    campaignId: string,
  ): Promise<number> {
    const { count, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('campaign_id', campaignId);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  /**
   * Live send progress from campaign counters + recipient-row status.
   * Recipient rows update per email; campaign sent_count updates per batch.
   */
  async getSendProgress(
    accountId: string,
    campaignId: string,
  ): Promise<CampaignSendProgressSnapshot> {
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .select(
        'status, audience_count, sent_count, failed_count, skipped_count, last_error',
      )
      .eq('account_id', accountId)
      .eq('id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Campaign not found');

    const row = data as Record<string, unknown>;
    const [sent, failed, skipped, pending] = await Promise.all([
      this.countRecipientsByStatus(accountId, campaignId, 'sent'),
      this.countRecipientsByStatus(accountId, campaignId, 'failed'),
      this.countRecipientsByStatus(accountId, campaignId, 'skipped'),
      this.countRecipientsByStatus(accountId, campaignId, 'pending'),
    ]);
    const hasRecipients = sent + failed + skipped + pending > 0;

    return buildCampaignSendProgress({
      status: row.status as EmailCampaignStatus,
      audienceCount: Number(row.audience_count ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      skippedCount: Number(row.skipped_count ?? 0),
      lastError: (row.last_error as string | null) ?? null,
      ratePerSecond: readCampaignSendSettings().ratePerSecond,
      recipientCounts: hasRecipients
        ? { sent, failed, skipped, pending }
        : null,
    });
  }

  private async countRecipientsByStatus(
    accountId: string,
    campaignId: string,
    status: EmailCampaignRecipient['status'],
  ): Promise<number> {
    const { count, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('campaign_id', campaignId)
      .eq('status', status);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async schedule(input: {
    accountId: string;
    campaignId: string;
    scheduledAt: string;
  }): Promise<EmailCampaign> {
    const campaign = await this.get(input.accountId, input.campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('Only draft campaigns can be scheduled');
    }

    this.assertReadyToSend(campaign);
    // Scheduling a series instance is an explicit Ready path (same as Mark ready).

    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new Error('Schedule time must be in the future');
    }

    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update({
        status: 'scheduled',
        scheduled_at: when.toISOString(),
        ...(campaign.seriesId ? { ready: true } : {}),
      })
      .eq('id', input.campaignId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not schedule campaign');
    }

    return mapCampaign(data as Record<string, unknown>);
  }

  async cancelSchedule(
    accountId: string,
    campaignId: string,
  ): Promise<EmailCampaign> {
    const campaign = await this.get(accountId, campaignId);
    if (campaign.status !== 'scheduled') {
      throw new Error('Only scheduled campaigns can be unscheduled');
    }

    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update({
        status: 'draft',
        ready: campaign.seriesId ? false : campaign.ready,
        scheduled_at: campaign.seriesId ? campaign.scheduledAt : null,
      })
      .eq('id', campaignId)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not cancel schedule');
    }

    return mapCampaign(data as Record<string, unknown>);
  }

  /**
   * Hard-delete a one-off campaign. Recipients and email events cascade.
   * Credit ledger and automations keep their rows with campaign_id cleared.
   * Scheduled sends are row-driven — deleting the campaign is enough.
   */
  async delete(accountId: string, campaignId: string): Promise<void> {
    const campaign = await this.get(accountId, campaignId);
    assertCampaignDeletable(campaign);

    const { error } = await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
      .delete()
      .eq('id', campaignId)
      .eq('account_id', accountId);

    if (error) throw new Error(error.message);
  }

  /**
   * Snapshot the campaign audience, debit send units, and hand the queue to
   * the send worker. The request does not wait for the blast to finish.
   */
  async startSend(input: {
    accountId: string;
    campaignId: string;
    workspaceName: string;
  }): Promise<{ campaign: EmailCampaign; remaining: number }> {
    void input.workspaceName;
    const campaign = await this.get(input.accountId, input.campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('This campaign is not ready to send');
    }
    if (!seriesInstanceMaySend(campaign)) {
      throw new Error('Mark this occurrence ready before sending');
    }

    this.assertReadyToSend(campaign);

    const recipients = await resolveCampaignAudience(
      this.client,
      input.accountId,
      campaign.audienceType,
      campaign.audienceConfig,
    );

    if (recipients.length === 0) {
      throw new Error('No recipients in the selected audience');
    }

    const usage = await getCampaignUsage(input.accountId);
    const maxContacts = usage.pool.max_contacts;
    if (maxContacts > 0 && recipients.length > maxContacts) {
      throw new CampaignQuotaError({
        kind: 'contacts',
        needed: recipients.length,
        have: maxContacts,
        message: describeCampaignQuota({
          kind: 'contacts',
          used: recipients.length,
          cap: maxContacts,
        }),
      });
    }

    if (usage.pool.balance < recipients.length) {
      throw new CampaignQuotaError({
        kind: 'sends',
        needed: recipients.length,
        have: usage.pool.balance,
        message: describeCampaignQuota({
          kind: 'sends',
          needed: recipients.length,
          have: usage.pool.balance,
        }),
      });
    }

    // Claim send without overwriting From / Reply-To (resolved later in processPending).
    const { data: claimed, error: statusError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update({
        status: 'sending',
        audience_count: recipients.length,
        scheduled_at: campaign.scheduledAt,
      })
      .eq('id', campaign.id)
      .eq('account_id', input.accountId)
      .in('status', ['draft', 'scheduled'])
      .select('id');

    if (statusError) throw new Error(statusError.message);
    if (!claimed?.length) {
      throw new Error('This campaign is already being processed');
    }

    // Debit runs only after the snapshot matches this audience. If debit
    // fails, the campaign returns to draft with those rows still in place.
    // A retry debits that snapshot when the emails still match. A same-sized
    // but different audience replaces the rows before debit.
    const existingEmails = await listSnapshotEmails(
      this.client,
      input.accountId,
      campaign.id,
    );

    if (!sameRecipientSnapshot(existingEmails, recipients)) {
      if (existingEmails.length > 0) {
        try {
          await deleteCampaignRecipientSnapshot(
            this.client,
            input.accountId,
            campaign.id,
          );
        } catch (deleteError) {
          const message =
            deleteError instanceof Error
              ? deleteError.message
              : 'Could not replace a partial recipient snapshot';
          await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
            .update({ status: 'failed', last_error: message })
            .eq('id', campaign.id)
            .eq('account_id', input.accountId);
          throw new Error(message);
        }
      }

      await this.insertRecipientSnapshot(input.accountId, campaign, recipients);
    }

    try {
      await debitCampaignCredits(
        input.accountId,
        recipients.length,
        campaign.id,
      );
    } catch (error) {
      const quota = isInsufficientCampaignCreditsError(error)
        ? new CampaignQuotaError({
            kind: 'sends',
            needed: recipients.length,
            have: error.balance,
            message: describeCampaignQuota({
              kind: 'sends',
              needed: recipients.length,
              have: error.balance,
            }),
          })
        : error;
      await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({
          status: 'draft',
          last_error:
            quota instanceof Error
              ? quota.message
              : 'Could not debit send units',
        })
        .eq('id', campaign.id)
        .eq('account_id', input.accountId);
      throw quota;
    }

    const { error: debitedError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update({ credits_debited_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('account_id', input.accountId);
    if (debitedError) {
      let refunded = false;
      try {
        await refundCampaignCredits(
          campaign.id,
          recipients.length,
          'debit_flag_failed',
        );
        refunded = true;
      } catch (refundError) {
        console.error(
          '[campaigns] could not refund after debit flag failed',
          campaign.id,
          refundError,
        );
      }
      await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({
          status: refunded ? 'draft' : 'failed',
          last_error: debitedError.message,
        })
        .eq('id', campaign.id)
        .eq('account_id', input.accountId);
      throw new Error(debitedError.message);
    }

    const kicked = kickCampaignSendContinuation({
      campaignId: campaign.id,
      accountId: input.accountId,
    });
    if (!kicked) {
      // Local runs without CRON_SECRET still move the queue a little.
      const drained = await this.processPending({
        accountId: input.accountId,
        campaignId: campaign.id,
        budgetMs: Math.min(readCampaignSendSettings().budgetMs, 8_000),
      });
      if (!drained.lockAcquired && drained.remaining > 0) {
        console.warn(
          '[campaigns] send worker was not started',
          campaign.id,
          drained.remaining,
        );
      }
      return drained;
    }

    const fresh = await this.get(input.accountId, campaign.id);
    return { campaign: fresh, remaining: recipients.length };
  }

  private async insertRecipientSnapshot(
    accountId: string,
    campaign: EmailCampaign,
    recipients: ResolvedCampaignRecipient[],
  ) {
    const rows = recipients.map((recipient) => ({
      campaign_id: campaign.id,
      account_id: accountId,
      preference_id: recipient.preferenceId,
      client_id: recipient.clientId,
      email: recipient.email,
      display_name: recipient.displayName,
      unsubscribe_token: recipient.unsubscribeToken,
      status: 'pending',
      ab_variant: campaign.abEnabled
        ? assignCampaignAbVariant(
            campaign.id,
            recipient.email,
            campaign.abSplitPercent,
          )
        : null,
    }));

    for (
      let offset = 0;
      offset < rows.length;
      offset += CAMPAIGN_RECIPIENT_INSERT_BATCH
    ) {
      const batch = rows.slice(
        offset,
        offset + CAMPAIGN_RECIPIENT_INSERT_BATCH,
      );
      const { error: insertError } = await fromTable(
        this.client,
        WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
      ).insert(batch);

      if (insertError) {
        // Credits are debited only after every batch lands. Mark failed
        // before deleting so a cron tick cannot send the partial snapshot.
        await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
          .update({ status: 'failed', last_error: insertError.message })
          .eq('id', campaign.id)
          .eq('account_id', accountId);

        try {
          await deleteCampaignRecipientSnapshot(
            this.client,
            accountId,
            campaign.id,
          );
        } catch (deleteError) {
          const rollback =
            deleteError instanceof Error
              ? deleteError.message
              : 'Could not roll back partial recipients';
          await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
            .update({
              status: 'failed',
              last_error: `${insertError.message} (snapshot rollback: ${rollback})`,
            })
            .eq('id', campaign.id)
            .eq('account_id', accountId);
        }

        throw new Error(insertError.message);
      }
    }
  }

  async processPending(input: {
    accountId: string;
    campaignId: string;
    budgetMs?: number;
  }): Promise<{
    campaign: EmailCampaign;
    remaining: number;
    lockAcquired: boolean;
  }> {
    const campaign = await this.get(input.accountId, input.campaignId);
    if (campaign.status !== 'sending') {
      return { campaign, remaining: 0, lockAcquired: false };
    }

    // startSend claims `sending` before the snapshot finishes. A cron tick
    // must not mail (or mark sent) until every recipient row is in place.
    const { count: snapshotCount, error: snapshotError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('account_id', input.accountId);

    if (snapshotError) throw new Error(snapshotError.message);

    const inserted = snapshotCount ?? 0;
    if (campaign.audienceCount > 0 && inserted < campaign.audienceCount) {
      return {
        campaign,
        remaining: campaign.audienceCount - inserted,
        lockAcquired: false,
      };
    }

    const { data: debitGate, error: debitGateError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .select('credits_debited_at')
      .eq('id', campaign.id)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (debitGateError) throw new Error(debitGateError.message);
    if (
      !(debitGate as { credits_debited_at?: string | null } | null)
        ?.credits_debited_at
    ) {
      return {
        campaign,
        remaining: Math.max(campaign.audienceCount - inserted, 0),
        lockAcquired: false,
      };
    }

    const settings = readCampaignSendSettings();
    const budgetMs = input.budgetMs ?? settings.budgetMs;
    const admin = getSupabaseServerAdminClient();
    const { data: lockData, error: lockError } = await callCampaignRpc(
      admin,
      'acquire_campaign_send_lock',
      {
        p_campaign_id: campaign.id,
        p_account_id: input.accountId,
        p_lock_seconds: Math.ceil(budgetMs / 1000) + 20,
      },
    );
    if (lockError) throw new Error(lockError.message);
    if (lockData !== true) {
      const pending = await this.countRecipientsByStatus(
        input.accountId,
        campaign.id,
        'pending',
      );
      return { campaign, remaining: pending, lockAcquired: false };
    }

    let lockSettled = false;
    try {
      const brand = await loadAccountBrandResolved(input.accountId);
      const { data: accountRow } = await this.client
        .from('accounts')
        .select('name')
        .eq('id', input.accountId)
        .maybeSingle();
      const sendingDomain = await loadAccountSendingDomain(
        this.client,
        input.accountId,
      );
      const resolved = resolveWorkspaceMailFrom({
        accountName:
          (accountRow as { name?: string | null } | null)?.name?.trim() ||
          campaign.fromName?.trim() ||
          'Agency',
        brandContactEmail: brand.contact_email,
        proposedFromEmail: campaign.fromEmail,
        proposedFromName: campaign.fromName,
        sendingDomain,
        platformFrom: getPlatformSesFrom(),
      });
      const fromEmail = resolved.fromEmail;
      if (!fromEmail) {
        throw new Error(
          'Add a verified sending domain in workspace settings, or set a contact email that can send from Ozer.',
        );
      }

      const fromName = resolved.fromName;
      const fromHeader = resolved.fromHeader ?? `${fromName} <${fromEmail}>`;
      const replyTo = resolveCampaignReplyTo({
        campaignReplyTo: campaign.replyTo,
        fromEmail,
        workspaceReplyTo: resolved.replyTo,
      });
      const shell = compileCampaignHtmlShell({
        brand,
        htmlBody: campaign.htmlBody,
        document: campaign.bodyDocument,
      });
      const deadline = Date.now() + budgetMs;
      const waveSize = campaignSendWaveSize(settings);
      let failed = 0;
      let skipped = 0;
      let throttled = false;
      let throttleMessage: string | null = null;

      while (Date.now() < deadline && !throttled) {
        const claimed = await claimCampaignRecipientWave(admin, {
          accountId: input.accountId,
          campaignId: campaign.id,
          limit: waveSize,
          leaseSeconds: settings.leaseSeconds,
        });
        if (claimed.recipients.length === 0) break;

        const preferenceById = await loadMailingPreferences(
          admin,
          input.accountId,
          [
            ...new Set(
              claimed.recipients
                .map((recipient) => recipient.preferenceId)
                .filter((id): id is string => Boolean(id)),
            ),
          ],
        );

        const outcome = await deliverClaimedRecipients({
          recipients: claimed.recipients,
          settings,
          throttleBackoffSeconds: settings.throttleBackoffSeconds,
          preferenceById,
          send: async (recipient, token) => {
            const merge = mergeValuesForRecipient({
              displayName: recipient.displayName,
              email: recipient.email,
              formUrl: formUrlForMerge({
                formLink: campaign.bodyDocument?.formLink,
                recipientEmail: recipient.email,
              }),
            });
            const html = personalizeCampaignHtml(shell, {
              brand,
              merge,
              unsubscribeToken: token,
            });
            const variant = recipient.abVariant === 'b' ? 'b' : 'a';
            return sendCampaignEmailViaSes({
              to: recipient.email,
              from: fromHeader,
              replyTo,
              subject: applyCampaignMergeText(
                subjectForAbVariant({
                  subject: campaign.subject,
                  subjectB: campaign.subjectB,
                  variant,
                }),
                merge,
              ),
              html,
              listUnsubscribeUrl:
                buildWorkspaceMailingListUnsubscribeUrl(token),
              accountId: input.accountId,
              sesTenant: resolved.sesTenantName ?? undefined,
              sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
              storeHtml: false,
              metadata: {
                campaign_id: campaign.id,
                recipient_id: recipient.id,
              },
            });
          },
          persist: (recipientId, patch) =>
            persistRecipientClaim(
              admin,
              recipientId,
              claimed.claimToken,
              patch,
            ),
        });

        skipped += outcome.skipped;
        failed += outcome.failed;
        throttled = outcome.throttled;
        if (outcome.throttleMessage) throttleMessage = outcome.throttleMessage;
      }

      const unused = skipped + failed;
      if (unused > 0) {
        await refundCampaignCredits(campaign.id, unused, 'unused_or_failed');
      }

      const counts = await campaignRecipientStatusCounts(
        admin,
        input.accountId,
        campaign.id,
      );
      const remaining = counts.pending;
      const sentCount = counts.sent;
      const failedCount = counts.failed;
      const skippedCount = counts.skipped;
      const unsubscribedCount = counts.unsubscribed;

      const finished = remaining === 0;
      const sendLockedUntil = throttled
        ? new Date(
            Date.now() + settings.throttleBackoffSeconds * 1000,
          ).toISOString()
        : null;
      const { data: updated, error: updateError } = await fromTable(
        this.client,
        WORKSPACE_EMAIL_CAMPAIGNS,
      )
        .update({
          sent_count: sentCount ?? 0,
          failed_count: failedCount ?? 0,
          skipped_count: skippedCount ?? 0,
          unsubscribed_count: unsubscribedCount ?? 0,
          status: finished ? 'sent' : 'sending',
          sent_at: finished ? new Date().toISOString() : null,
          send_locked_until: finished ? null : sendLockedUntil,
          last_error: throttled ? throttleMessage : null,
        })
        .eq('id', campaign.id)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (updateError || !updated) {
        throw new Error(updateError?.message ?? 'Could not update campaign');
      }

      lockSettled = true;

      if (
        shouldContinueCampaignSend({
          remaining,
          throttled,
          lockAcquired: true,
          snapshotIncomplete: false,
        })
      ) {
        kickCampaignSendContinuation({
          campaignId: campaign.id,
          accountId: input.accountId,
        });
      }

      return {
        campaign: mapCampaign(updated as Record<string, unknown>),
        remaining,
        lockAcquired: true,
      };
    } catch (error) {
      if (!lockSettled) {
        await fromTable(admin, WORKSPACE_EMAIL_CAMPAIGNS)
          .update({ send_locked_until: null })
          .eq('id', campaign.id)
          .eq('account_id', input.accountId);
      }
      throw error;
    }
  }

  /**
   * Send a free test of the current campaign HTML to explicit addresses.
   * Does not enqueue the mailing list, change campaign status, or debit credits.
   */
  async sendTest(input: {
    accountId: string;
    campaignId: string;
    emails: string[];
    displayNames?: Record<string, string | null | undefined>;
  }): Promise<{ sent: number; failed: number; subject: string }> {
    const emails = normalizeCampaignTestEmails(input.emails);
    if (emails.length === 0) {
      throw new Error('Add at least one valid email address');
    }
    if (emails.length > CAMPAIGN_TEST_MAX_RECIPIENTS) {
      throw new Error(
        `You can send a test to at most ${CAMPAIGN_TEST_MAX_RECIPIENTS} addresses at once`,
      );
    }

    const campaign = await this.get(input.accountId, input.campaignId);
    this.assertReadyToSend(campaign);

    const brand = await loadAccountBrandResolved(input.accountId);
    const { data: accountRow } = await this.client
      .from('accounts')
      .select('name')
      .eq('id', input.accountId)
      .maybeSingle();
    const sendingDomain = await loadAccountSendingDomain(
      this.client,
      input.accountId,
    );
    const resolved = resolveWorkspaceMailFrom({
      accountName:
        (accountRow as { name?: string | null } | null)?.name?.trim() ||
        campaign.fromName?.trim() ||
        'Agency',
      brandContactEmail: brand.contact_email,
      proposedFromEmail: campaign.fromEmail,
      proposedFromName: campaign.fromName,
      sendingDomain,
      platformFrom: getPlatformSesFrom(),
    });
    const fromEmail = resolved.fromEmail;
    if (!fromEmail) {
      throw new Error(
        'Add a verified sending domain in workspace settings, or set a contact email that can send from Ozer.',
      );
    }

    const fromName = resolved.fromName;
    const fromHeader = resolved.fromHeader ?? `${fromName} <${fromEmail}>`;
    const replyTo = resolveCampaignReplyTo({
      campaignReplyTo: campaign.replyTo,
      fromEmail,
      workspaceReplyTo: resolved.replyTo,
    });
    const subjectTemplate = campaignTestSubject(campaign.subject);
    const unsubscribeUrl = buildWorkspaceMailingListUnsubscribeUrl(
      CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
    );

    let sent = 0;
    let failed = 0;
    let lastSubject = subjectTemplate;
    const errors: string[] = [];

    for (const email of emails) {
      const displayName =
        input.displayNames?.[email]?.trim() ||
        input.displayNames?.[email.toLowerCase()]?.trim() ||
        null;

      try {
        const merge = mergeValuesForRecipient({
          displayName,
          email,
          formUrl: formUrlForMerge({
            formLink: campaign.bodyDocument?.formLink,
            recipientEmail: email,
          }),
        });
        const html = renderCampaignHtml({
          brand,
          htmlBody: campaign.htmlBody,
          document: campaign.bodyDocument,
          merge,
          unsubscribeToken: CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
        });
        const subject = applyCampaignMergeText(subjectTemplate, merge);
        lastSubject = subject;

        await sendCampaignEmailViaSes({
          to: email,
          from: fromHeader,
          replyTo,
          subject,
          html,
          listUnsubscribeUrl: unsubscribeUrl,
          accountId: input.accountId,
          sesTenant: resolved.sesTenantName ?? undefined,
          sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
          emailType: 'campaign_test',
          metadata: {
            campaign_id: campaign.id,
            test_send: true,
          },
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        errors.push(
          `${email}: ${err instanceof Error ? err.message : 'Send failed'}`,
        );
      }
    }

    if (sent === 0) {
      throw new Error(
        errors[0] ?? 'Could not send test email. Check your sending domain.',
      );
    }

    return { sent, failed, subject: lastSubject };
  }

  private assertReadyToSend(campaign: EmailCampaign) {
    if (
      campaignAudienceListMissing(
        campaign.audienceType,
        campaign.audienceConfig,
      )
    ) {
      throw new Error(CAMPAIGN_AUDIENCE_LIST_REQUIRED);
    }
    if (!campaign.subject.trim()) {
      throw new Error('Add a subject before sending');
    }
    if (campaign.abEnabled && !campaign.subjectB?.trim()) {
      throw new Error('Add subject B before sending an A/B test');
    }
    const hasContent = campaign.bodyDocument
      ? campaignDocumentHasContent(campaign.bodyDocument)
      : Boolean(campaign.htmlBody.replace(/<[^>]+>/g, '').trim());
    if (!hasContent) {
      throw new Error('Write the email body before sending');
    }
  }
}

export async function processDueCampaignSends(client: SupabaseClient): Promise<{
  started: number;
  continued: number;
  generated: number;
}> {
  const generated = await generateMissingSeriesInstances(client);

  const service = createCampaignsService(client);
  let started = 0;
  let continued = 0;

  const { data: due } = await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
    .select('id, account_id, series_id, ready')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10);

  for (const row of (due ?? []) as Array<{
    id: string;
    account_id: string;
    series_id: string | null;
    ready: boolean | null;
  }>) {
    if (
      !seriesInstanceMaySend({
        seriesId: row.series_id,
        ready: row.ready !== false,
        status: 'scheduled',
      })
    ) {
      continue;
    }
    const { data: account } = await fromTable(client, 'accounts')
      .select('name')
      .eq('id', row.account_id)
      .maybeSingle();

    try {
      await service.startSend({
        accountId: row.account_id,
        campaignId: row.id,
        workspaceName:
          (account as { name?: string } | null)?.name?.trim() || 'Workspace',
      });
      started += 1;
    } catch (error) {
      const quota = error instanceof CampaignQuotaError;
      await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({
          status: quota ? 'scheduled' : 'failed',
          last_error:
            error instanceof Error ? error.message : 'Scheduled send failed',
        })
        .eq('id', row.id)
        .eq('account_id', row.account_id);
    }
  }

  const { data: sending } = await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
    .select('id, account_id')
    .eq('status', 'sending')
    .order('updated_at', { ascending: true })
    .limit(10);

  for (const row of (sending ?? []) as Array<{
    id: string;
    account_id: string;
  }>) {
    try {
      const result = await service.processPending({
        accountId: row.account_id,
        campaignId: row.id,
      });
      // One drain per tick. A 4-minute budget must not start a second blast
      // in the same invocation. Campaigns that lose the lock wait for the
      // next minute, or for the active drain to chain itself.
      if (result.lockAcquired) {
        continued += 1;
        break;
      }
    } catch {
      // Leave status as sending so the next cron tick retries this campaign.
    }
  }

  return { started, continued, generated };
}

export async function markCampaignRecipientsUnsubscribed(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<void> {
  await fromTable(client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('email', email)
    .is('unsubscribed_at', null);

  const { data: campaigns } = await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
    .select('id')
    .eq('account_id', accountId);

  for (const row of (campaigns ?? []) as Array<{ id: string }>) {
    const { count } = await fromTable(
      client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', row.id)
      .not('unsubscribed_at', 'is', null);

    await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
      .update({ unsubscribed_count: count ?? 0 })
      .eq('id', row.id);
  }
}
