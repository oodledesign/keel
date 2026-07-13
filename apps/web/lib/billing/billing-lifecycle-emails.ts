import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import type { BillingEmailKind } from './account-billing-types';

type AnyClient = SupabaseClient<any>;

export async function loadWorkspaceOwnerEmail(
  admin: AnyClient,
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

export async function notificationAlreadySent(
  admin: AnyClient,
  subscriptionId: string,
  notificationType: BillingEmailKind,
): Promise<boolean> {
  const { data } = await admin
    .from('billing_notification_log')
    .select('id')
    .eq('subscription_id', subscriptionId)
    .eq('notification_type', notificationType)
    .maybeSingle();

  return Boolean(data);
}

export async function markNotificationSent(
  admin: AnyClient,
  input: {
    accountId: string;
    subscriptionId: string;
    notificationType: BillingEmailKind;
  },
): Promise<void> {
  await admin.from('billing_notification_log').upsert(
    {
      account_id: input.accountId,
      subscription_id: input.subscriptionId,
      notification_type: input.notificationType,
    },
    { onConflict: 'subscription_id,notification_type', ignoreDuplicates: true },
  );
}

function escapeHtml(value: string) {
  return escapeEmailHtml(value);
}

function formatGbDate(value: Date | string | null | undefined) {
  if (!value) return 'soon';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function wrapOzerEmail(input: {
  productName: string;
  preview: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  return renderOzerTransactionalEmail({
    title: input.title,
    preview: input.preview,
    heading: input.title,
    bodyHtml: input.bodyHtml,
    cta: { label: input.ctaLabel, href: input.ctaUrl },
    footerNote: `You're receiving this because you own a ${escapeHtml(input.productName)} workspace.`,
    productName: input.productName,
  });
}

export function buildBillingLifecycleEmail(input: {
  emailKind: BillingEmailKind;
  productName: string;
  accountName: string;
  billingUrl: string;
  trialEndsAt?: string | null;
}): { subject: string; html: string; preview: string } {
  const safeAccountName = input.accountName.replace(/[\r\n]+/g, ' ').trim();
  const name = escapeHtml(safeAccountName);
  const product = escapeHtml(input.productName);
  const ends = formatGbDate(input.trialEndsAt);

  switch (input.emailKind) {
    case 'trial_day_7':
      return {
        subject: `How’s ${safeAccountName} going so far?`,
        preview: 'A quick look at what you’ve set up halfway through your trial.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Halfway through your Ozer trial',
          title: 'You’re halfway through your trial',
          ctaLabel: 'Open workspace',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>Seven days in on <strong>${name}</strong> — a good moment to check you’ve got clients, projects, and your plan for the week in place.</p>
            <p>Your ${product} trial still has about a week left. No card needed yet.</p>`,
        }),
      };

    case 'trial_ending_3d':
      return {
        subject: `${safeAccountName} trial ends in 3 days`,
        preview: 'Add billing when you’re ready — your data stays put.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Trial ending in three days',
          title: 'Your trial ends in three days',
          ctaLabel: 'Review plans & billing',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>Your trial for <strong>${name}</strong> ends on <strong>${ends}</strong>.</p>
            <p>Have a look at Solo and Team pricing, then add a payment method when you’re ready. Nothing is charged until the trial finishes.</p>`,
        }),
      };

    case 'trial_ending_1d':
      return {
        subject: `${safeAccountName} trial ends tomorrow`,
        preview: 'What stops working if you don’t subscribe.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Trial ends tomorrow',
          title: 'Trial ends tomorrow',
          ctaLabel: 'Add payment method',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>Your trial for <strong>${name}</strong> ends on <strong>${ends}</strong>.</p>
            <p>Without an active plan, paid workspace features (clients, projects, invoices, pipeline, and scheduling) will move to a limited state. Your data is kept.</p>`,
        }),
      };

    case 'trial_ended':
      return {
        subject: `${safeAccountName} trial has ended`,
        preview: 'Subscribe to restore full access.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Your trial has ended',
          title: 'Your trial has ended',
          ctaLabel: 'Restore access',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>The trial for <strong>${name}</strong> on ${product} has finished.</p>
            <p>Add a payment method to unlock the full workspace again. Nothing has been deleted.</p>`,
        }),
      };

    case 'payment_failed':
      return {
        subject: `We couldn’t take payment for ${safeAccountName}`,
        preview: 'Nothing is broken yet — please update your card.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Payment failed',
          title: 'We couldn’t take payment',
          ctaLabel: 'Update payment method',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>We couldn’t collect the latest payment for <strong>${name}</strong>.</p>
            <p>Your workspace still has full access while we retry. Please update your card when you can.</p>`,
        }),
      };

    case 'payment_reminder_3d':
      return {
        subject: `Reminder: payment still needed for ${safeAccountName}`,
        preview: 'Access will become limited soon if payment isn’t updated.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Payment still overdue',
          title: 'Payment still outstanding',
          ctaLabel: 'Update payment method',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>We still haven’t received payment for <strong>${name}</strong>.</p>
            <p>In a few days, access may become limited (read-only for some areas) until billing is sorted. Client-facing booking pages stay up during this grace period.</p>`,
        }),
      };

    case 'payment_reminder_7d':
    case 'account_restricted':
      return {
        subject: `${safeAccountName} is now restricted`,
        preview: 'Update billing to restore full access.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Workspace restricted',
          title: 'Your workspace is now restricted',
          ctaLabel: 'Fix billing',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p><strong>${name}</strong> is in restricted mode because payment is still overdue.</p>
            <p>You can view existing work, but creating and editing may be limited until you update your payment method.</p>`,
        }),
      };

    case 'account_suspended':
      return {
        subject: `${safeAccountName} has been suspended`,
        preview: 'Access is blocked. Data is kept for 30 days.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Workspace suspended',
          title: 'Account suspended',
          ctaLabel: 'Reactivate workspace',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>Access to <strong>${name}</strong> is blocked because we couldn’t collect payment after several attempts.</p>
            <p>Your data is retained for 30 days. Update billing any time to reactivate.</p>`,
        }),
      };

    case 'cancel_warning':
      return {
        subject: `Final notice for ${safeAccountName}`,
        preview: 'Your suspended workspace will be marked cancelled soon. Data retention policy applies.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Final notice before cancellation',
          title: 'Final notice before cancellation',
          ctaLabel: 'Reactivate now',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p><strong>${name}</strong> has been suspended for 30 days.</p>
            <p>We’ll mark the subscription as cancelled shortly. This email is a final chance to reactivate — we are not deleting your data in this step.</p>`,
        }),
      };

    case 'payment_recovered':
      return {
        subject: `You’re back — ${safeAccountName} is active`,
        preview: 'Payment succeeded. Full access restored.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Payment recovered',
          title: 'You’re back',
          ctaLabel: 'Open workspace',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>Payment for <strong>${name}</strong> succeeded and full access is restored.</p>
            <p>Thanks for sorting billing — you’re all set.</p>`,
        }),
      };

    case 'subscription_canceled':
      return {
        subject: `${safeAccountName} subscription cancelled`,
        preview: 'Your Ozer subscription has been cancelled.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Subscription cancelled',
          title: 'Subscription cancelled',
          ctaLabel: 'View billing',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>The subscription for <strong>${name}</strong> has been cancelled.</p>
            <p>You can resubscribe from billing whenever you’re ready.</p>`,
        }),
      };

    default:
      return {
        subject: `${input.productName} billing update`,
        preview: 'Billing update for your workspace.',
        html: wrapOzerEmail({
          productName: input.productName,
          preview: 'Billing update',
          title: 'Billing update',
          ctaLabel: 'Manage billing',
          ctaUrl: input.billingUrl,
          bodyHtml: `<p>There’s a billing update for <strong>${name}</strong>.</p>`,
        }),
      };
  }
}

export async function sendBillingLifecycleEmail(
  admin: AnyClient,
  input: {
    accountId: string;
    emailKind: BillingEmailKind;
    accountName: string;
    accountSlug: string;
    subscriptionId: string;
    trialEndsAt?: string | null;
    ownerEmail?: string | null;
  },
): Promise<'sent' | 'skipped'> {
  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || 'Ozer';

  if (!sender || !siteUrl) {
    throw new Error('EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured');
  }

  if (
    await notificationAlreadySent(admin, input.subscriptionId, input.emailKind)
  ) {
    return 'skipped';
  }

  const ownerEmail =
    input.ownerEmail ?? (await loadWorkspaceOwnerEmail(admin, input.accountId));
  if (!ownerEmail) {
    return 'skipped';
  }

  const billingUrl = new URL(
    pathsConfig.app.accountBilling.replace('[account]', input.accountSlug),
    siteUrl,
  ).toString();

  const { subject, html } = buildBillingLifecycleEmail({
    emailKind: input.emailKind,
    productName,
    accountName: input.accountName,
    billingUrl,
    trialEndsAt: input.trialEndsAt,
  });

  await sendPlatformEmail({
    type: 'billing',
    accountId: input.accountId,
    mail: {
      to: ownerEmail,
      from: sender,
      subject,
      html,
    },
    metadata: {
      notification_type: input.emailKind,
      subscription_id: input.subscriptionId,
    },
  });

  await markNotificationSent(admin, {
    accountId: input.accountId,
    subscriptionId: input.subscriptionId,
    notificationType: input.emailKind,
  });

  return 'sent';
}
