import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import pathsConfig from '~/config/paths.config';

export type BillingNotificationType =
  | 'trial_ending_3d'
  | 'trial_ending_1d'
  | 'trial_ended'
  | 'payment_failed';

type TrialReminderRow = {
  subscriptionId: string;
  accountId: string;
  accountName: string;
  accountSlug: string;
  trialEndsAt: Date;
  notificationType: BillingNotificationType;
  ownerEmail: string;
};

export async function runBillingTrialReminders(
  admin: SupabaseClient,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return {
      sent: 0,
      skipped: 0,
      errors: ['EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured'],
    };
  }

  const candidates = await loadTrialReminderCandidates(admin);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    const alreadySent = await admin
      .from('billing_notification_log')
      .select('id')
      .eq('subscription_id', row.subscriptionId)
      .eq('notification_type', row.notificationType)
      .maybeSingle();

    if (alreadySent.data) {
      skipped++;
      continue;
    }

    const billingUrl = new URL(
      pathsConfig.app.accountBilling.replace('[account]', row.accountSlug),
      siteUrl,
    ).toString();

    const { subject, html } = buildTrialEmail({
      productName,
      accountName: row.accountName,
      trialEndsAt: row.trialEndsAt,
      notificationType: row.notificationType,
      billingUrl,
    });

    try {
      await sendPlatformEmail({
        type: 'billing',
        accountId: row.accountId,
        mail: {
          to: row.ownerEmail,
          from: sender,
          subject,
          html,
        },
        metadata: {
          notification_type: row.notificationType,
          subscription_id: row.subscriptionId,
        },
      });

      await admin.from('billing_notification_log').insert({
        account_id: row.accountId,
        subscription_id: row.subscriptionId,
        notification_type: row.notificationType,
      });

      sent++;
    } catch (err) {
      errors.push(
        `${row.subscriptionId}: ${err instanceof Error ? err.message : 'send failed'}`,
      );
    }
  }

  return { sent, skipped, errors };
}

async function loadTrialReminderCandidates(
  admin: SupabaseClient,
): Promise<TrialReminderRow[]> {
  const now = Date.now();
  const inThreeDays = now + 3 * 24 * 60 * 60 * 1000;
  const inOneDay = now + 24 * 60 * 60 * 1000;

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select(
      'id, account_id, status, trial_ends_at, accounts!inner(id, name, slug)',
    )
    .eq('status', 'trialing')
    .not('trial_ends_at', 'is', null);

  if (error || !subs?.length) {
    return [];
  }

  const results: TrialReminderRow[] = [];

  for (const sub of subs) {
    const trialEndsAt = new Date((sub as { trial_ends_at: string }).trial_ends_at);
    const endsMs = trialEndsAt.getTime();
    const account = (sub as { accounts: { id: string; name: string | null; slug: string | null } })
      .accounts;
    const accountId = (sub as { account_id: string }).account_id;
    const subscriptionId = (sub as { id: string }).id;
    const slug = account.slug;

    if (!slug) continue;

    let notificationType: BillingNotificationType | null = null;

    if (endsMs <= now) {
      notificationType = 'trial_ended';
    } else if (endsMs <= inOneDay) {
      notificationType = 'trial_ending_1d';
    } else if (endsMs <= inThreeDays) {
      notificationType = 'trial_ending_3d';
    }

    if (!notificationType) continue;

    const ownerEmail = await loadWorkspaceOwnerEmail(admin, accountId);
    if (!ownerEmail) continue;

    results.push({
      subscriptionId,
      accountId,
      accountName: account.name ?? slug,
      accountSlug: slug,
      trialEndsAt,
      notificationType,
      ownerEmail,
    });
  }

  return results;
}

async function loadWorkspaceOwnerEmail(
  admin: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const { data: membership } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('account_role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const userId = (membership as { user_id?: string } | null)?.user_id;
  if (!userId) return null;

  const { data: userResult, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userResult.user?.email) return null;

  return userResult.user.email;
}

function buildTrialEmail(input: {
  productName: string;
  accountName: string;
  trialEndsAt: Date;
  notificationType: BillingNotificationType;
  billingUrl: string;
}) {
  const endsLabel = input.trialEndsAt.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (input.notificationType === 'trial_ended') {
    return {
      subject: `${input.accountName} trial ended — add billing to keep access`,
      html: wrapEmail(
        `<p>Your trial for <strong>${escapeHtml(input.accountName)}</strong> on ${escapeHtml(input.productName)} has ended.</p>
        <p>Add a payment method to restore full access to this workspace.</p>
        <p><a href="${input.billingUrl}">Manage billing</a></p>`,
      ),
    };
  }

  if (input.notificationType === 'trial_ending_1d') {
    return {
      subject: `${input.accountName} trial ends tomorrow`,
      html: wrapEmail(
        `<p>Your trial for <strong>${escapeHtml(input.accountName)}</strong> ends on ${endsLabel}.</p>
        <p>Subscribe now to avoid interruption.</p>
        <p><a href="${input.billingUrl}">Manage billing</a></p>`,
      ),
    };
  }

  return {
    subject: `${input.accountName} trial ending soon`,
    html: wrapEmail(
      `<p>Your trial for <strong>${escapeHtml(input.accountName)}</strong> ends on ${endsLabel}.</p>
      <p>You can subscribe anytime from billing — your workspace data stays put.</p>
      <p><a href="${input.billingUrl}">Manage billing</a></p>`,
    ),
  };
}

function wrapEmail(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">${body}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendPaymentFailedEmail(
  admin: SupabaseClient,
  input: {
    subscriptionId: string;
    accountId: string;
    accountSlug: string;
    accountName: string;
  },
): Promise<void> {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) return;

  const alreadySent = await admin
    .from('billing_notification_log')
    .select('id')
    .eq('subscription_id', input.subscriptionId)
    .eq('notification_type', 'payment_failed')
    .maybeSingle();

  if (alreadySent.data) return;

  const ownerEmail = await loadWorkspaceOwnerEmail(admin, input.accountId);
  if (!ownerEmail) return;

  const billingUrl = new URL(
    pathsConfig.app.accountBilling.replace('[account]', input.accountSlug),
    siteUrl,
  ).toString();

  await sendPlatformEmail({
    type: 'billing',
    accountId: input.accountId,
    mail: {
      to: ownerEmail,
      from: sender,
      subject: `Payment failed for ${input.accountName}`,
      html: wrapEmail(
        `<p>We could not process the latest payment for <strong>${escapeHtml(input.accountName)}</strong> on ${escapeHtml(productName)}.</p>
      <p>Update your payment method to keep this workspace active.</p>
      <p><a href="${billingUrl}">Manage billing</a></p>`,
      ),
    },
    metadata: {
      notification_type: 'payment_failed',
      subscription_id: input.subscriptionId,
    },
  });

  await admin.from('billing_notification_log').insert({
    account_id: input.accountId,
    subscription_id: input.subscriptionId,
    notification_type: 'payment_failed',
  });
}
