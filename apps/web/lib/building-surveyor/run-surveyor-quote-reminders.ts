import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  type DueQuoteReminder,
  QUOTE_REMINDER_STAGE,
  type QuoteReminderEvent,
  selectDueQuoteReminders,
} from './quote-reminders';
import {
  DEFAULT_SURVEYOR_PIPELINE_SETTINGS,
  type SurveyorPipelineSettings,
  normalizeSurveyorPipelineSettings,
} from './surveyor-lead';

type AccountRow = { id: string; slug: string | null; name: string | null };

type DealRow = {
  id: string;
  account_id: string;
  stage: string;
  updated_at: string;
  contact_name: string | null;
  contact_email: string | null;
  company_name: string | null;
  assigned_to: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dealLabel(deal: DealRow): string {
  return (
    deal.contact_name?.trim() || deal.company_name?.trim() || 'A quoted lead'
  );
}

async function loadSurveyorEmails(
  admin: SupabaseClient,
  account: AccountRow,
  assignedTo: string | null,
): Promise<string[]> {
  if (assignedTo) {
    const { data } = await admin
      .from('accounts')
      .select('email')
      .eq('id', assignedTo)
      .eq('is_personal_account', true)
      .maybeSingle();
    const email = (data?.email as string | null | undefined)?.trim();
    if (email) return [email.toLowerCase()];
  }
  if (!account.slug) return [];
  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });
  return Array.from(
    new Set(
      ((members ?? []) as { role?: string | null; email?: string | null }[])
        .filter((member) => member.role === 'owner' && member.email)
        .map((member) => (member.email as string).toLowerCase()),
    ),
  );
}

async function loadSentQuoteUrl(
  admin: SupabaseClient,
  accountId: string,
  dealId: string,
  siteUrl: string,
): Promise<string | null> {
  const { data } = await admin
    .from('proposals')
    .select('public_token')
    .eq('account_id', accountId)
    .eq('deal_id', dealId)
    .eq('kind', 'proposal')
    .in('status', ['sent', 'read'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = (data?.public_token as string | null | undefined) ?? null;
  return token ? new URL(`/portal/proposals/${token}`, siteUrl).href : null;
}

async function remindSurveyor(params: {
  admin: SupabaseClient;
  account: AccountRow;
  deal: DealRow;
  due: DueQuoteReminder;
  siteUrl: string | undefined;
}) {
  const { admin, account, deal, due, siteUrl } = params;
  const label = dealLabel(deal);
  const leadPath = account.slug
    ? pathsConfig.app.accountPipelineLead
        .replace('[account]', account.slug)
        .replace('[dealId]', deal.id)
    : undefined;
  const body = `${label} has been in Quote sent for ${due.daysInStage} days. Time to follow up.`;

  await createInAppNotification({
    accountId: account.id,
    body,
    link: leadPath,
  });

  const from = resolveTransactionalEmailFrom();
  if (!from || !siteUrl) return;
  const emails = await loadSurveyorEmails(admin, account, deal.assigned_to);
  if (emails.length === 0) return;

  const leadUrl = leadPath ? new URL(leadPath, siteUrl).href : null;
  const brand = await loadAccountBrandResolved(account.id);
  const innerHtml = `
    <h2 style="margin:0 0 16px">Follow up on a quote</h2>
    <p>${escapeHtml(body)}</p>
    ${leadUrl ? `<p style="margin:24px 0 0"><a href="${leadUrl}">Open the lead</a></p>` : ''}
  `;

  await Promise.allSettled(
    emails.map((email) =>
      sendPlatformEmail({
        type: 'surveyor_quote_reminder',
        accountId: account.id,
        mail: {
          from,
          to: email,
          subject: `Quote follow-up: ${label}`,
          html: wrapEmailHtmlWithBrand({ brand, innerHtml }),
        },
        metadata: { deal_id: deal.id, audience: 'surveyor' },
      }),
    ),
  );
}

async function remindClient(params: {
  admin: SupabaseClient;
  account: AccountRow;
  deal: DealRow;
  siteUrl: string | undefined;
}): Promise<boolean> {
  const { admin, account, deal, siteUrl } = params;
  const to = deal.contact_email?.trim();
  if (!to || !siteUrl) return false;
  const quoteUrl = await loadSentQuoteUrl(admin, account.id, deal.id, siteUrl);
  if (!quoteUrl) return false;

  const firmName = account.name?.trim() || 'your surveyor';
  const firstName = deal.contact_name?.trim().split(/\s+/)[0];
  const brand = await loadAccountBrandResolved(account.id);
  const innerHtml = `
    <p>${firstName ? `Hi ${escapeHtml(firstName)},` : 'Hello,'}</p>
    <p>Just a reminder that your survey quote from ${escapeHtml(firmName)} is ready to review. Let us know if you have any questions or would like to go ahead.</p>
    <p style="margin:24px 0 0"><a href="${quoteUrl}">View your quote</a></p>
  `;

  await sendClientFacingEmail({
    type: 'surveyor_quote_reminder',
    accountId: account.id,
    feature: 'proposals',
    accountName: account.name,
    brandContactEmail: brand.contact_email,
    mail: {
      to,
      subject: `Your survey quote from ${firmName}`,
      html: wrapEmailHtmlWithBrand({ brand, innerHtml }),
    },
    metadata: { deal_id: deal.id, audience: 'client' },
  });
  return true;
}

/**
 * Daily: remind the surveyor (and optionally the client) about building
 * surveyor leads that have sat in "Quote sent" past the workspace threshold.
 * Sent once per entry into the stage, tracked with `reminder_sent` events.
 */
export async function runSurveyorQuoteReminders(admin: SupabaseClient) {
  const { data: accounts, error: accountsErr } = await admin
    .from('accounts')
    .select('id, slug, name')
    .eq('space_type', 'building-surveyor')
    .eq('is_personal_account', false);
  if (accountsErr) throw new Error(accountsErr.message);

  const accountRows = (accounts ?? []) as AccountRow[];
  if (accountRows.length === 0) return { sent: 0, skipped: 0, errors: [] };
  const accountIds = accountRows.map((row) => row.id);
  const accountById = new Map(accountRows.map((row) => [row.id, row]));

  const [settingsResult, dealsResult] = await Promise.all([
    admin
      .from('survey_account_settings')
      .select('account_id, quote_reminder_days, quote_reminder_client_email')
      .in('account_id', accountIds),
    admin
      .from('pipeline_deals')
      .select(
        'id, account_id, stage, updated_at, contact_name, contact_email, company_name, assigned_to',
      )
      .in('account_id', accountIds)
      .eq('stage', QUOTE_REMINDER_STAGE)
      .is('lost_at', null),
  ]);
  if (dealsResult.error) throw new Error(dealsResult.error.message);

  const settingsByAccount = new Map<string, SurveyorPipelineSettings>();
  for (const row of (settingsResult.data ?? []) as {
    account_id: string;
    quote_reminder_days: unknown;
    quote_reminder_client_email: unknown;
  }[]) {
    settingsByAccount.set(
      row.account_id,
      normalizeSurveyorPipelineSettings(row),
    );
  }

  const deals = (dealsResult.data ?? []) as DealRow[];
  if (deals.length === 0) return { sent: 0, skipped: 0, errors: [] };
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));

  const { data: eventRows, error: eventsErr } = await admin
    .from('pipeline_deal_events')
    .select('deal_id, event_type, to_stage, created_at')
    .in(
      'deal_id',
      deals.map((deal) => deal.id),
    )
    .in('event_type', ['created', 'stage_changed', 'reminder_sent']);
  if (eventsErr) throw new Error(eventsErr.message);

  const events: QuoteReminderEvent[] = (
    (eventRows ?? []) as {
      deal_id: string;
      event_type: string;
      to_stage: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    dealId: row.deal_id,
    eventType: row.event_type,
    toStage: row.to_stage,
    createdAt: row.created_at,
  }));

  const due = selectDueQuoteReminders({
    deals: deals.map((deal) => ({
      id: deal.id,
      accountId: deal.account_id,
      stage: deal.stage,
      updatedAt: deal.updated_at,
    })),
    events,
    reminderDaysByAccount: new Map(
      Array.from(settingsByAccount, ([id, settings]) => [
        id,
        settings.quoteReminderDays,
      ]),
    ),
    defaultReminderDays: DEFAULT_SURVEYOR_PIPELINE_SETTINGS.quoteReminderDays,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let sent = 0;
  const errors: string[] = [];

  for (const item of due) {
    const deal = dealById.get(item.dealId);
    const account = accountById.get(item.accountId);
    if (!deal || !account) continue;
    const settings =
      settingsByAccount.get(account.id) ?? DEFAULT_SURVEYOR_PIPELINE_SETTINGS;

    try {
      await remindSurveyor({ admin, account, deal, due: item, siteUrl });
      let clientReminded = false;
      if (settings.quoteReminderClientEmail) {
        try {
          clientReminded = await remindClient({
            admin,
            account,
            deal,
            siteUrl,
          });
        } catch (err) {
          errors.push(
            `${deal.id}: client email failed — ${err instanceof Error ? err.message : 'unknown'}`,
          );
        }
      }

      const { error: logErr } = await admin
        .from('pipeline_deal_events')
        .insert({
          account_id: account.id,
          deal_id: deal.id,
          event_type: 'reminder_sent',
          detail: { client: clientReminded, days: item.daysInStage },
          actor_id: null,
        });
      if (logErr) {
        errors.push(`${deal.id}: log insert failed — ${logErr.message}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(
        `${deal.id}: ${err instanceof Error ? err.message : 'reminder failed'}`,
      );
    }
  }

  return { sent, skipped: deals.length - due.length, errors };
}
