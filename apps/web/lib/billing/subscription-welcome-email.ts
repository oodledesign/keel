import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UpsertSubscriptionParams } from '@kit/billing/types';

import billingConfig from '~/config/billing.config';
import pathsConfig from '~/config/paths.config';
import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';

import type { BillingEmailKind } from './account-billing-types';
import { loadAccountMeta } from './account-billing-lifecycle';
import { loadBillingCustomerEmail } from './billing-customer-email';
import {
  enqueueBillingEmail,
  type BillingEmailPayload,
} from './billing-email-outbox';
import { notificationAlreadySent } from './billing-lifecycle-emails';
import {
  findPlanByStripePriceId,
  type OzerPlanDefinition,
  type OzerPlanFamily,
} from './ozer-plan-catalog';

type AnyClient = SupabaseClient<any>;

export type SubscriptionWelcomeStep = {
  label: string;
  href: string;
};

export type SubscriptionWelcomeContext = {
  productName: string;
  planLabel: string;
  billingInterval: 'month' | 'year' | null;
  productDescription: string;
  features: string[];
  gettingStartedSteps: SubscriptionWelcomeStep[];
  isTrial: boolean;
  planFamily: OzerPlanFamily;
};

function absoluteAppUrl(path: string, siteUrl: string) {
  return new URL(path, siteUrl).toString();
}

function workspacePaths(accountSlug: string, siteUrl: string) {
  const replace = (template: string) =>
    absoluteAppUrl(template.replace('[account]', accountSlug), siteUrl);

  return {
    home: replace(pathsConfig.app.accountHome),
    members: replace(pathsConfig.app.accountMembersInvites),
    clients: replace(pathsConfig.app.accountClients),
    billing: replace(pathsConfig.app.accountBilling),
    listings: replace(pathsConfig.app.accountListings),
    commercialProperties: replace(pathsConfig.app.accountCommercialProperties),
  };
}

function gettingStartedSteps(
  family: OzerPlanFamily,
  accountSlug: string,
  siteUrl: string,
): SubscriptionWelcomeStep[] {
  const paths = workspacePaths(accountSlug, siteUrl);

  switch (family) {
    case 'community':
      return [
        { label: 'Open your workspace', href: paths.home },
        { label: 'Invite members', href: paths.members },
        { label: 'Review billing & plan', href: paths.billing },
      ];
    case 'commercial_property':
      return [
        { label: 'Open your workspace', href: paths.home },
        { label: 'Set up listings & pipeline', href: paths.listings },
        { label: 'Invite your team', href: paths.members },
        { label: 'Manage billing & receipts', href: paths.billing },
      ];
    case 'property':
      return [
        { label: 'Open your workspace', href: paths.home },
        { label: 'Add your first property', href: paths.commercialProperties },
        { label: 'Invite collaborators', href: paths.members },
        { label: 'Manage billing & receipts', href: paths.billing },
      ];
    case 'business_lite':
      return [
        { label: 'Open your workspace', href: paths.home },
        { label: 'Browse apps in the marketplace', href: paths.home },
        { label: 'Invite teammates', href: paths.members },
        { label: 'Manage billing', href: paths.billing },
      ];
    case 'business':
    default:
      return [
        { label: 'Open your workspace', href: paths.home },
        { label: 'Add your first client', href: paths.clients },
        { label: 'Invite your team', href: paths.members },
        { label: 'Manage billing & download receipts', href: paths.billing },
      ];
  }
}

function resolvePrimaryWorkspacePlan(
  subscription: UpsertSubscriptionParams,
): OzerPlanDefinition | null {
  for (const item of subscription.line_items ?? []) {
    const variantId = item.variant_id;
    if (!variantId) continue;

    const plan = findPlanByStripePriceId(variantId);
    if (plan?.workspaceProfiles?.length) {
      return plan;
    }
  }

  return null;
}

export function resolveSubscriptionWelcomeContext(
  subscription: UpsertSubscriptionParams,
  input: {
    accountSlug: string;
    siteUrl: string;
  },
): SubscriptionWelcomeContext | null {
  const plan = resolvePrimaryWorkspacePlan(subscription);
  if (!plan) {
    return null;
  }

  const product = billingConfig.products.find(
    (entry) => entry.id === plan.productId,
  );
  const planConfig = product?.plans.find((entry) => entry.id === plan.planId);

  const productName = product?.name?.trim() || 'Ozer workspace';
  const planLabel = planConfig?.name?.trim() || plan.planId;
  const billingInterval = planConfig?.interval ?? null;
  const productDescription =
    product?.description?.trim() ||
    'Your workspace is ready — here is what you can do next.';
  const features = (product?.features ?? []).slice(0, 6);
  const isTrial = subscription.status === 'trialing';

  return {
    productName,
    planLabel,
    billingInterval,
    productDescription,
    features,
    gettingStartedSteps: gettingStartedSteps(
      plan.family,
      input.accountSlug,
      input.siteUrl,
    ),
    isTrial,
    planFamily: plan.family,
  };
}

function formatGbDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function intervalLabel(interval: 'month' | 'year' | null) {
  if (interval === 'year') return 'Yearly billing';
  if (interval === 'month') return 'Monthly billing';
  return null;
}

function featuresHtml(features: string[]) {
  if (features.length === 0) {
    return '';
  }

  const items = features
    .map(
      (feature) =>
        `<li style="margin:0 0 6px;padding:0;">${escapeEmailHtml(feature)}</li>`,
    )
    .join('');

  return `<p style="margin:16px 0 8px;"><strong>Included in your plan:</strong></p>
    <ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
}

function stepsHtml(steps: SubscriptionWelcomeStep[]) {
  const items = steps
    .map(
      (step, index) =>
        `<li style="margin:0 0 8px;padding:0;"><a href="${escapeEmailHtml(step.href)}" style="color:inherit;text-decoration:underline;">${index + 1}. ${escapeEmailHtml(step.label)}</a></li>`,
    )
    .join('');

  return `<p style="margin:16px 0 8px;"><strong>Good first steps:</strong></p>
    <ol style="margin:0 0 16px;padding-left:20px;">${items}</ol>`;
}

export function buildSubscriptionWelcomeEmail(input: {
  productName: string;
  accountName: string;
  workspaceUrl: string;
  welcome: SubscriptionWelcomeContext;
  trialEndsAt?: string | null;
}): { subject: string; html: string; preview: string } {
  const name = escapeEmailHtml(input.accountName.trim() || 'your workspace');
  const planName = escapeEmailHtml(input.welcome.productName);
  const planLabel = escapeEmailHtml(input.welcome.planLabel);
  const interval = intervalLabel(input.welcome.billingInterval);
  const trialEnds = formatGbDate(input.trialEndsAt);

  const title = input.welcome.isTrial
    ? `Your ${input.welcome.productName} trial has started`
    : `Welcome to ${input.welcome.productName}`;

  const preview = input.welcome.isTrial
    ? `${input.welcome.productName} trial — plan details and first steps inside.`
    : `You're on ${input.welcome.productName}. Here is what to do first.`;

  const intro = input.welcome.isTrial
    ? `<p>Thanks for choosing <strong>${planName}</strong> for <strong>${name}</strong>. Your trial is live${
        trialEnds ? ` until <strong>${escapeEmailHtml(trialEnds)}</strong>` : ''
      }.</p>`
    : `<p>Thanks for subscribing to <strong>${planName}</strong> for <strong>${name}</strong>. Payment is confirmed and your workspace is ready.</p>`;

  const receiptNote = input.welcome.isTrial
    ? `<p style="margin:16px 0 0;color:var(--muted,#666);font-size:13px;">You won't be charged until the trial ends. We'll email reminders before billing starts. Stripe may send a receipt when your first payment is taken.</p>`
    : `<p style="margin:16px 0 0;color:var(--muted,#666);font-size:13px;">Stripe may also send a payment receipt to your inbox — you can download invoices any time from billing settings.</p>`;

  const planMeta = [
    planLabel,
    interval,
    input.welcome.isTrial ? '14-day trial' : 'Active',
  ]
    .filter(Boolean)
    .map((part) => escapeEmailHtml(String(part)))
    .join(' · ');

  const bodyHtml = `${intro}
    <p style="margin:12px 0 0;">${escapeEmailHtml(input.welcome.productDescription)}</p>
    <p style="margin:16px 0 8px;padding:12px 14px;border-radius:12px;background:rgba(0,0,0,0.04);"><strong>${planName}</strong><br /><span style="font-size:13px;color:var(--muted,#666);">${planMeta}</span></p>
    ${featuresHtml(input.welcome.features)}
    ${stepsHtml(input.welcome.gettingStartedSteps)}
    ${receiptNote}`;

  const html = renderOzerTransactionalEmail({
    title,
    preview,
    heading: title,
    bodyHtml,
    cta: { label: 'Open workspace', href: input.workspaceUrl },
    footerNote: `You're receiving this because you subscribed to ${escapeEmailHtml(input.productName)} for ${name}.`,
    productName: input.productName,
  });

  const subject = input.welcome.isTrial
    ? `${input.accountName.trim() || 'Your workspace'} — ${input.welcome.productName} trial is live`
    : `Welcome to ${input.welcome.productName} — ${input.accountName.trim() || 'your workspace'}`;

  return { subject, html, preview };
}

export type SubscriptionWelcomeEmailPayload = BillingEmailPayload &
  SubscriptionWelcomeContext;

/**
 * Queue a one-time welcome email after a new workspace subscription checkout.
 * Skips add-on-only checkouts and dedupes per subscription.
 */
export async function enqueueSubscriptionWelcomeEmail(
  admin: AnyClient,
  input: {
    subscription: UpsertSubscriptionParams;
    stripeEventId?: string | null;
  },
): Promise<{ enqueued: boolean; id?: string }> {
  const accountId = input.subscription.target_account_id;
  const subscriptionId = input.subscription.target_subscription_id;

  if (!accountId || !subscriptionId) {
    return { enqueued: false };
  }

  const emailKind: BillingEmailKind = 'subscription_welcome';

  if (await notificationAlreadySent(admin, subscriptionId, emailKind)) {
    return { enqueued: false };
  }

  const meta = await loadAccountMeta(admin, accountId);
  if (!meta?.slug) {
    return { enqueued: false };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL not configured');
  }

  const welcome = resolveSubscriptionWelcomeContext(input.subscription, {
    accountSlug: meta.slug,
    siteUrl,
  });

  if (!welcome) {
    return { enqueued: false };
  }

  const trialEndsAt =
    typeof input.subscription.trial_ends_at === 'string'
      ? input.subscription.trial_ends_at
      : input.subscription.trial_ends_at != null
        ? new Date(Number(input.subscription.trial_ends_at) * 1000).toISOString()
        : null;

  const stripeEventId =
    input.stripeEventId ?? `subscription-welcome:${subscriptionId}`;

  const payerEmail = input.subscription.target_customer_id
    ? await loadBillingCustomerEmail(
        admin,
        accountId,
        input.subscription.target_customer_id,
      )
    : null;

  return enqueueBillingEmail(admin, {
    accountId,
    emailKind,
    stripeEventId,
    payload: {
      accountSlug: meta.slug,
      accountName: meta.name,
      subscriptionId,
      trialEndsAt,
      payerEmail,
      ...welcome,
    } satisfies SubscriptionWelcomeEmailPayload,
  });
}
