import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { debitCampaignCredits } from '~/lib/campaign-credits/ledger';
import { formUrlForMerge } from '~/lib/campaigns/form-link';
import {
  applyCampaignMergeText,
  mergeValuesForRecipient,
} from '~/lib/campaigns/merge-fields';
import { renderCampaignHtml } from '~/lib/campaigns/render-campaign-html';
import { resolveCampaignReplyTo } from '~/lib/campaigns/resolve-campaign-reply-to';
import { sendCampaignEmailViaSes } from '~/lib/campaigns/send-campaign-email';
import {
  getPlatformSesFrom,
  loadAccountSendingDomain,
  resolveWorkspaceMailFrom,
} from '~/lib/sending-domains/server';
import { buildWorkspaceMailingListUnsubscribeUrl } from '~/lib/workspace-forms/workspace-mailing-list';

import type {
  CampaignAutomation,
  CampaignAutomationRun,
} from './campaign.types';
import { createCampaignsService } from './campaigns.service';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapAutomation(row: Record<string, unknown>): CampaignAutomation {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    triggerType: 'new_subscriber',
    campaignId: (row.campaign_id as string | null) ?? null,
    status: row.status === 'active' ? 'active' : 'paused',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRun(row: Record<string, unknown>): CampaignAutomationRun {
  return {
    id: String(row.id),
    automationId: String(row.automation_id),
    campaignId: (row.campaign_id as string | null) ?? null,
    email: String(row.email),
    status: row.status as CampaignAutomationRun['status'],
    errorMessage: (row.error_message as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function createCampaignAutomationsService(client: SupabaseClient) {
  return new CampaignAutomationsService(client);
}

class CampaignAutomationsService {
  constructor(private readonly client: SupabaseClient) {}

  async list(accountId: string): Promise<CampaignAutomation[]> {
    const { data, error } = await fromTable(this.client, 'campaign_automations')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapAutomation);
  }

  async listRuns(
    accountId: string,
    automationId: string,
  ): Promise<CampaignAutomationRun[]> {
    const { data, error } = await fromTable(
      this.client,
      'campaign_automation_runs',
    )
      .select('*')
      .eq('account_id', accountId)
      .eq('automation_id', automationId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapRun);
  }

  async create(input: {
    accountId: string;
    userId: string;
    name: string;
    campaignId: string;
  }): Promise<CampaignAutomation> {
    const { data, error } = await fromTable(this.client, 'campaign_automations')
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name: input.name.trim() || 'Welcome new subscribers',
        trigger_type: 'new_subscriber',
        campaign_id: input.campaignId,
        status: 'paused',
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create automation');
    }
    return mapAutomation(data as Record<string, unknown>);
  }

  async update(input: {
    accountId: string;
    automationId: string;
    name?: string;
    campaignId?: string | null;
    status?: 'active' | 'paused';
  }): Promise<CampaignAutomation> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.campaignId !== undefined) patch.campaign_id = input.campaignId;
    if (input.status !== undefined) patch.status = input.status;

    const { data, error } = await fromTable(this.client, 'campaign_automations')
      .update(patch)
      .eq('account_id', input.accountId)
      .eq('id', input.automationId)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not update automation');
    }
    return mapAutomation(data as Record<string, unknown>);
  }

  async delete(accountId: string, automationId: string): Promise<void> {
    const { error } = await fromTable(this.client, 'campaign_automations')
      .delete()
      .eq('account_id', accountId)
      .eq('id', automationId);
    if (error) throw new Error(error.message);
  }
}

/**
 * Fire welcome automations for a newly subscribed address.
 * Available on every Campaigns plan (Starter+). Never throws to the form
 * path — failures are logged as skipped/failed runs.
 */
export async function fireNewSubscriberAutomations(input: {
  client: SupabaseClient;
  accountId: string;
  email: string;
  displayName?: string | null;
  unsubscribeToken: string;
}): Promise<void> {
  const logger = await getLogger();
  const { data, error } = await fromTable(input.client, 'campaign_automations')
    .select('*')
    .eq('account_id', input.accountId)
    .eq('trigger_type', 'new_subscriber')
    .eq('status', 'active');

  if (error) {
    logger.warn(
      { name: 'campaigns.automation', error: error.message },
      'Could not load welcome automations',
    );
    return;
  }

  const automations = ((data ?? []) as Array<Record<string, unknown>>).map(
    mapAutomation,
  );

  for (const automation of automations) {
    if (!automation.campaignId) continue;
    try {
      await sendWelcomeAutomationEmail({
        client: input.client,
        accountId: input.accountId,
        automation,
        email: input.email,
        displayName: input.displayName ?? null,
        unsubscribeToken: input.unsubscribeToken,
      });
    } catch (err) {
      logger.warn(
        {
          name: 'campaigns.automation',
          automationId: automation.id,
          error: err instanceof Error ? err.message : 'send failed',
        },
        'Welcome automation failed',
      );
    }
  }
}

async function sendWelcomeAutomationEmail(input: {
  client: SupabaseClient;
  accountId: string;
  automation: CampaignAutomation;
  email: string;
  displayName: string | null;
  unsubscribeToken: string;
}) {
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await fromTable(
    input.client,
    'campaign_automation_runs',
  )
    .select('id')
    .eq('automation_id', input.automation.id)
    .eq('email', email)
    .maybeSingle();

  if (existing) return;

  const { data: run, error: insertError } = await fromTable(
    input.client,
    'campaign_automation_runs',
  )
    .insert({
      account_id: input.accountId,
      automation_id: input.automation.id,
      campaign_id: input.automation.campaignId,
      email,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError || !run) {
    if (/unique|duplicate/i.test(insertError?.message ?? '')) return;
    throw new Error(insertError?.message ?? 'Could not enqueue automation');
  }

  try {
    const campaignId = input.automation.campaignId;
    if (!campaignId) {
      throw new Error('Automation has no linked campaign');
    }

    await debitCampaignCredits(input.accountId, 1, campaignId);
  } catch (error) {
    await fromTable(input.client, 'campaign_automation_runs')
      .update({
        status: 'skipped',
        error_message:
          error instanceof Error
            ? error.message
            : 'Not enough campaign send units',
      })
      .eq('id', run.id);
    return;
  }

  const campaigns = createCampaignsService(input.client);
  const campaign = await campaigns.get(input.accountId, campaignId);

  const brand = await loadAccountBrandResolved(input.accountId);
  const { data: accountRow } = await input.client
    .from('accounts')
    .select('name')
    .eq('id', input.accountId)
    .maybeSingle();
  const sendingDomain = await loadAccountSendingDomain(
    input.client,
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

  if (!resolved.fromEmail) {
    await fromTable(input.client, 'campaign_automation_runs')
      .update({
        status: 'failed',
        error_message: 'No verified sending domain',
      })
      .eq('id', run.id);
    return;
  }

  const merge = mergeValuesForRecipient({
    displayName: input.displayName,
    email,
    formUrl: formUrlForMerge({
      formLink: campaign.bodyDocument?.formLink,
      recipientEmail: email,
    }),
  });
  const html = renderCampaignHtml({
    brand,
    htmlBody: campaign.htmlBody,
    merge,
    unsubscribeToken: input.unsubscribeToken,
  });

  const { messageId } = await sendCampaignEmailViaSes({
    to: email,
    from: resolved.fromHeader ?? `${resolved.fromName} <${resolved.fromEmail}>`,
    replyTo: resolveCampaignReplyTo({
      campaignReplyTo: campaign.replyTo,
      fromEmail: resolved.fromEmail,
      workspaceReplyTo: resolved.replyTo,
    }),
    subject: applyCampaignMergeText(campaign.subject, merge),
    html,
    listUnsubscribeUrl: buildWorkspaceMailingListUnsubscribeUrl(
      input.unsubscribeToken,
    ),
    accountId: input.accountId,
    sesTenant: resolved.sesTenantName ?? undefined,
    sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
    metadata: {
      campaign_id: campaign.id,
      automation_id: input.automation.id,
      automation_run_id: String(run.id),
    },
  });

  await fromTable(input.client, 'campaign_automation_runs')
    .update({
      status: 'sent',
      ses_message_id: messageId,
      sent_at: new Date().toISOString(),
    })
    .eq('id', run.id);
}
