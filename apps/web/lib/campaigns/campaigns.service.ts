import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  debitCampaignCredits,
  getCampaignUsage,
  isInsufficientCampaignCreditsError,
  refundCampaignCredits,
} from '~/lib/campaign-credits/ledger';
import {
  campaignDocumentHasContent,
  parseCampaignDocument,
  resolveCampaignDocument,
} from '~/lib/campaigns/campaign-document';
import { compileCampaignDocument } from '~/lib/campaigns/compile-campaign-document';
import { formUrlForMerge } from '~/lib/campaigns/form-link';
import { mergeValuesForRecipient } from '~/lib/campaigns/merge-fields';
import {
  CAMPAIGN_TEST_MAX_RECIPIENTS,
  CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
  campaignTestSubject,
  normalizeCampaignTestEmails,
} from '~/lib/campaigns/campaign-test-send';
import { renderCampaignHtml } from '~/lib/campaigns/render-campaign-html';
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
import {
  buildWorkspaceMailingListUnsubscribeUrl,
  listWorkspaceMailingListSubscribers,
} from '~/lib/workspace-forms/workspace-mailing-list';

import type {
  EmailCampaign,
  EmailCampaignRecipient,
  EmailCampaignStatus,
} from './campaign.types';

export type {
  EmailCampaign,
  EmailCampaignRecipient,
  EmailCampaignStatus,
} from './campaign.types';

/** Add-on tables. Distinct from admin marketing `email_campaigns`. */
const WORKSPACE_EMAIL_CAMPAIGNS = 'workspace_email_campaigns';
const WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS =
  'workspace_email_campaign_recipients';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    subject: String(row.subject ?? ''),
    previewText: (row.preview_text as string | null) ?? null,
    htmlBody: String(row.html_body ?? ''),
    bodyDocument: parseCampaignDocument(row.body_document),
    fromName: (row.from_name as string | null) ?? null,
    fromEmail: (row.from_email as string | null) ?? null,
    replyTo: (row.reply_to as string | null) ?? null,
    status: row.status as EmailCampaignStatus,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createCampaignsService(client: SupabaseClient) {
  return new CampaignsService(client);
}

class CampaignsService {
  constructor(private readonly client: SupabaseClient) {}

  async list(accountId: string): Promise<EmailCampaign[]> {
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

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
  }): Promise<EmailCampaign> {
    const existing = await this.get(input.accountId, input.campaignId);
    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      throw new Error('Only draft or scheduled campaigns can be edited');
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.subject !== undefined) patch.subject = input.subject.trim();
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
  ): Promise<EmailCampaignRecipient[]> {
    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select(
        'id, campaign_id, email, display_name, status, skip_reason, error_message, ses_message_id, sent_at, unsubscribed_at, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, bounce_subtype, complaint_at',
      )
      .eq('account_id', accountId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

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
    }));
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
      .update({ status: 'draft', scheduled_at: null })
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
   * Snapshot the subscribed mailing list, debit send units, and send a batch.
   */
  async startSend(input: {
    accountId: string;
    campaignId: string;
    workspaceName: string;
    batchSize?: number;
  }): Promise<{ campaign: EmailCampaign; remaining: number }> {
    const campaign = await this.get(input.accountId, input.campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('This campaign is not ready to send');
    }

    this.assertReadyToSend(campaign);

    const subscribers = await listWorkspaceMailingListSubscribers(
      this.client,
      input.accountId,
    );

    if (subscribers.length === 0) {
      throw new Error('No subscribed contacts on the mailing list');
    }

    const usage = await getCampaignUsage(input.accountId);
    const maxContacts = usage.pool.max_contacts;
    if (maxContacts > 0 && subscribers.length > maxContacts) {
      throw new Error(
        `This plan allows ${maxContacts} contacts. The mailing list has ${subscribers.length}. Upgrade or unsubscribe extras before sending.`,
      );
    }

    if (usage.pool.balance < subscribers.length) {
      throw new Error(
        `Not enough send units. Need ${subscribers.length}, have ${usage.pool.balance}.`,
      );
    }

    const brand = await loadAccountBrandResolved(input.accountId);
    const fromEmail = brand.contact_email?.trim();
    if (!fromEmail) {
      throw new Error(
        'Set a contact email in Brand settings. Campaigns send as the workspace, not Ozer.',
      );
    }

    const fromName = input.workspaceName.trim() || fromEmail;

    const { data: claimed, error: statusError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGNS,
    )
      .update({
        status: 'sending',
        from_name: fromName,
        from_email: fromEmail,
        reply_to: fromEmail,
        audience_count: subscribers.length,
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

    const rows = subscribers.map((subscriber) => ({
      campaign_id: campaign.id,
      account_id: input.accountId,
      preference_id: subscriber.preferenceId,
      client_id: subscriber.clientId,
      email: subscriber.email,
      display_name: subscriber.displayName,
      unsubscribe_token: null as string | null,
      status: 'pending',
    }));

    const { data: prefs } = await fromTable(
      this.client,
      'workspace_mailing_preferences',
    )
      .select('id, unsubscribe_token')
      .eq('account_id', input.accountId)
      .in(
        'id',
        subscribers.map((item) => item.preferenceId),
      );

    const tokenById = new Map(
      ((prefs ?? []) as Array<{ id: string; unsubscribe_token: string }>).map(
        (row) => [row.id, row.unsubscribe_token],
      ),
    );

    for (const row of rows) {
      row.unsubscribe_token = tokenById.get(row.preference_id) ?? null;
    }

    const { error: insertError } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    ).insert(rows);

    if (insertError) {
      await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({ status: 'failed', last_error: insertError.message })
        .eq('id', campaign.id);
      throw new Error(insertError.message);
    }

    try {
      await debitCampaignCredits(
        input.accountId,
        subscribers.length,
        campaign.id,
      );
    } catch (error) {
      await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({
          status: 'failed',
          last_error: isInsufficientCampaignCreditsError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not debit send units',
        })
        .eq('id', campaign.id);
      throw error;
    }

    return this.processPending({
      accountId: input.accountId,
      campaignId: campaign.id,
      batchSize: input.batchSize,
    });
  }

  async processPending(input: {
    accountId: string;
    campaignId: string;
    batchSize?: number;
  }): Promise<{ campaign: EmailCampaign; remaining: number }> {
    const campaign = await this.get(input.accountId, input.campaignId);
    if (campaign.status !== 'sending') {
      return { campaign, remaining: 0 };
    }

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
    const replyTo = campaign.replyTo?.trim() || resolved.replyTo || fromEmail;
    const limit = Math.max(1, Math.min(input.batchSize ?? 40, 100));

    const { data, error } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select(
        'id, email, display_name, preference_id, unsubscribe_token, status',
      )
      .eq('campaign_id', campaign.id)
      .eq('account_id', input.accountId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    const pending = (data ?? []) as Array<{
      id: string;
      email: string;
      display_name: string | null;
      preference_id: string | null;
      unsubscribe_token: string | null;
    }>;

    const preferenceIds = [
      ...new Set(
        pending
          .map((recipient) => recipient.preference_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const prefById = new Map<
      string,
      { marketing_status?: string; unsubscribe_token?: string }
    >();

    if (preferenceIds.length > 0) {
      const { data: prefs, error: prefsError } = await fromTable(
        this.client,
        'workspace_mailing_preferences',
      )
        .select('id, marketing_status, unsubscribe_token')
        .eq('account_id', input.accountId)
        .in('id', preferenceIds);

      if (prefsError) throw new Error(prefsError.message);

      for (const row of (prefs ?? []) as Array<{
        id: string;
        marketing_status?: string;
        unsubscribe_token?: string;
      }>) {
        prefById.set(row.id, row);
      }
    }

    let failed = 0;
    let skipped = 0;

    for (const recipient of pending) {
      const preference = recipient.preference_id
        ? (prefById.get(recipient.preference_id) ?? null)
        : null;

      const status = preference?.marketing_status;
      const token =
        recipient.unsubscribe_token || preference?.unsubscribe_token;

      if (status && status !== 'subscribed') {
        await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
          .update({
            status: 'skipped',
            skip_reason: 'unsubscribed',
          })
          .eq('id', recipient.id);
        skipped += 1;
        continue;
      }

      if (!token) {
        await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
          .update({
            status: 'skipped',
            skip_reason: 'missing_unsubscribe_token',
          })
          .eq('id', recipient.id);
        skipped += 1;
        continue;
      }

      try {
        const html = renderCampaignHtml({
          brand,
          htmlBody: campaign.htmlBody,
          merge: mergeValuesForRecipient({
            displayName: recipient.display_name,
            email: recipient.email,
            formUrl: formUrlForMerge({
              formLink: campaign.bodyDocument?.formLink,
              recipientEmail: recipient.email,
            }),
          }),
          unsubscribeToken: token,
        });

        const { messageId } = await sendCampaignEmailViaSes({
          to: recipient.email,
          from: fromHeader,
          replyTo,
          subject: campaign.subject,
          html,
          listUnsubscribeUrl: buildWorkspaceMailingListUnsubscribeUrl(token),
          accountId: input.accountId,
          sesTenant: resolved.sesTenantName ?? undefined,
          sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
          metadata: {
            campaign_id: campaign.id,
            recipient_id: recipient.id,
          },
        });

        await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
          .update({
            status: 'sent',
            ses_message_id: messageId,
            sent_at: new Date().toISOString(),
            unsubscribe_token: token,
          })
          .eq('id', recipient.id);
        // counted from the table after the batch
      } catch (err) {
        await fromTable(this.client, WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS)
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Send failed',
          })
          .eq('id', recipient.id);
        failed += 1;
      }
    }

    const unused = skipped + failed;
    if (unused > 0) {
      await refundCampaignCredits(campaign.id, unused, 'unused_or_failed');
    }

    const { count: remainingCount } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending');

    const remaining = remainingCount ?? 0;

    const { count: sentCount } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent');

    const { count: failedCount } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed');

    const { count: skippedCount } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'skipped');

    const { count: unsubscribedCount } = await fromTable(
      this.client,
      WORKSPACE_EMAIL_CAMPAIGN_RECIPIENTS,
    )
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .not('unsubscribed_at', 'is', null);

    const finished = remaining === 0;
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
      })
      .eq('id', campaign.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Could not update campaign');
    }

    return {
      campaign: mapCampaign(updated as Record<string, unknown>),
      remaining,
    };
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
    const replyTo = campaign.replyTo?.trim() || resolved.replyTo || fromEmail;
    const subject = campaignTestSubject(campaign.subject);
    const unsubscribeUrl = buildWorkspaceMailingListUnsubscribeUrl(
      CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
    );

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const email of emails) {
      const displayName =
        input.displayNames?.[email]?.trim() ||
        input.displayNames?.[email.toLowerCase()]?.trim() ||
        null;

      try {
        const html = renderCampaignHtml({
          brand,
          htmlBody: campaign.htmlBody,
          merge: mergeValuesForRecipient({
            displayName,
            email,
            formUrl: formUrlForMerge({
              formLink: campaign.bodyDocument?.formLink,
              recipientEmail: email,
            }),
          }),
          unsubscribeToken: CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
        });

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

    return { sent, failed, subject };
  }

  private assertReadyToSend(campaign: EmailCampaign) {
    if (!campaign.subject.trim()) {
      throw new Error('Add a subject before sending');
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
}> {
  const service = createCampaignsService(client);
  let started = 0;
  let continued = 0;

  const { data: due } = await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
    .select('id, account_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10);

  for (const row of (due ?? []) as Array<{ id: string; account_id: string }>) {
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
      await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
        .update({
          status: 'failed',
          last_error:
            error instanceof Error ? error.message : 'Scheduled send failed',
        })
        .eq('id', row.id);
    }
  }

  const { data: sending } = await fromTable(client, WORKSPACE_EMAIL_CAMPAIGNS)
    .select('id, account_id')
    .eq('status', 'sending')
    .limit(10);

  for (const row of (sending ?? []) as Array<{
    id: string;
    account_id: string;
  }>) {
    try {
      await service.processPending({
        accountId: row.account_id,
        campaignId: row.id,
      });
      continued += 1;
    } catch {
      // Leave status as sending so the next cron tick retries this campaign.
    }
  }

  return { started, continued };
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
