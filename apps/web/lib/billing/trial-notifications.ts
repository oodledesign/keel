import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

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
    const trialEndsAt = new Date(
      (sub as { trial_ends_at: string }).trial_ends_at,
    );
    const endsMs = trialEndsAt.getTime();
    const account = (
      sub as {
        accounts: { id: string; name: string | null; slug: string | null };
      }
    ).accounts;
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

  const { data: userResult, error } =
    await admin.auth.admin.getUserById(userId);
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
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">Your trial for <strong>${escapeNotificationHtml(input.accountName)}</strong> on ${escapeNotificationHtml(input.productName)} has ended.</p>
        <p style="margin:0;">Add a payment method to restore full access to this workspace.</p>`,
        {
          productName: input.productName,
          title: 'Your trial has ended',
          heading: 'Your trial has ended',
          preview: `${input.accountName} trial ended`,
          cta: { label: 'Manage billing', href: input.billingUrl },
          footerNote: `You're receiving this because you own a ${escapeNotificationHtml(input.productName)} workspace.`,
        },
      ),
    };
  }

  if (input.notificationType === 'trial_ending_1d') {
    return {
      subject: `${input.accountName} trial ends tomorrow`,
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">Your trial for <strong>${escapeNotificationHtml(input.accountName)}</strong> ends on ${endsLabel}.</p>
        <p style="margin:0;">Subscribe now to avoid interruption.</p>`,
        {
          productName: input.productName,
          title: 'Your trial ends tomorrow',
          heading: 'Your trial ends tomorrow',
          preview: `${input.accountName} trial ends tomorrow`,
          cta: { label: 'Manage billing', href: input.billingUrl },
          footerNote: `You're receiving this because you own a ${escapeNotificationHtml(input.productName)} workspace.`,
        },
      ),
    };
  }

  return {
    subject: `${input.accountName} trial ending soon`,
    html: wrapNotificationEmail(
      `<p style="margin:0 0 12px;">Your trial for <strong>${escapeNotificationHtml(input.accountName)}</strong> ends on ${endsLabel}.</p>
      <p style="margin:0;">You can subscribe anytime from billing — your workspace data stays put.</p>`,
      {
        productName: input.productName,
        title: 'Your trial is ending soon',
        heading: 'Your trial is ending soon',
        preview: `${input.accountName} trial ending soon`,
        cta: { label: 'Manage billing', href: input.billingUrl },
        footerNote: `You're receiving this because you own a ${escapeNotificationHtml(input.productName)} workspace.`,
      },
    ),
  };
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
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">We could not process the latest payment for <strong>${escapeNotificationHtml(input.accountName)}</strong> on ${escapeNotificationHtml(productName)}.</p>
      <p style="margin:0;">Update your payment method to keep this workspace active.</p>`,
        {
          productName,
          title: 'Payment failed',
          heading: 'Payment failed',
          preview: `Payment failed for ${input.accountName}`,
          cta: { label: 'Manage billing', href: billingUrl },
          footerNote: `You're receiving this because you own a ${escapeNotificationHtml(productName)} workspace.`,
        },
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
