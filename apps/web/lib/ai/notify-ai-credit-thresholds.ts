import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

function roundAiCredits(value: number): number {
  return Math.round(Number(value) * 10) / 10;
}

function totalAvailable(balance: {
  credits_remaining: number;
  credits_purchased?: number;
}): number {
  return roundAiCredits(
    Math.max(0, Number(balance.credits_remaining ?? 0)) +
      Math.max(0, Number(balance.credits_purchased ?? 0)),
  );
}

/** Bitmask: bit0=50%, bit1=25%, bit2=10%, bit3=0%. */
export const AI_CREDIT_ALERT_BIT = {
  pct50: 1 << 0,
  pct25: 1 << 1,
  pct10: 1 << 2,
  exhausted: 1 << 3,
} as const;

type ThresholdKey = keyof typeof AI_CREDIT_ALERT_BIT;

const THRESHOLDS: Array<{
  key: ThresholdKey;
  /** Notify when pctLeft is at or below this (0 = exhausted). */
  maxPctLeft: number;
}> = [
  { key: 'pct50', maxPctLeft: 50 },
  { key: 'pct25', maxPctLeft: 25 },
  { key: 'pct10', maxPctLeft: 10 },
  { key: 'exhausted', maxPctLeft: 0 },
];

/** Exported for unit tests — which thresholds are newly crossed. */
export function selectCreditAlertThresholds(input: {
  pctLeft: number;
  alertsSent: number;
}): { emailKey: ThresholdKey; markBits: number } | null {
  const newlyCrossed = THRESHOLDS.filter((t) => {
    const bit = AI_CREDIT_ALERT_BIT[t.key];
    if ((input.alertsSent & bit) !== 0) return false;
    return input.pctLeft <= t.maxPctLeft;
  });

  if (newlyCrossed.length === 0) {
    return null;
  }

  const lowest = newlyCrossed[newlyCrossed.length - 1]!;
  const markBits = newlyCrossed.reduce(
    (mask, t) => mask | AI_CREDIT_ALERT_BIT[t.key],
    0,
  );

  return { emailKey: lowest.key, markBits };
}
const MIN_MONTHLY_LIMIT = 100;

export const AI_CREDITS_EXHAUSTED_BODY_PREFIX = "You're out of AI credits";

export type AiCreditAlertBalance = {
  credits_remaining: number;
  credits_monthly_limit: number;
  credits_purchased?: number;
  period_start: string;
  credit_alerts_sent?: number;
  credit_alert_period_start?: string | null;
};

/**
 * After a successful debit (or when a call fails for insufficient credits),
 * email the primary owner if a monthly threshold was newly crossed.
 * Never throws.
 */
export async function notifyAiCreditThresholds(params: {
  accountId: string;
  balance: AiCreditAlertBalance;
  /** When true, treat available as 0 for threshold math (failed call). */
  forceExhausted?: boolean;
  creditsRequired?: number;
}): Promise<void> {
  try {
    const admin = getSupabaseServerAdminClient();
    const limit = roundAiCredits(params.balance.credits_monthly_limit);

    if (limit < MIN_MONTHLY_LIMIT) {
      return;
    }

    const available = params.forceExhausted
      ? 0
      : totalAvailable(params.balance);
    const pctLeft = limit > 0 ? (available / limit) * 100 : 0;

    const periodStart = params.balance.period_start;
    let alertsSent = Number(params.balance.credit_alerts_sent ?? 0);
    const alertPeriod = params.balance.credit_alert_period_start ?? null;

    if (alertPeriod !== periodStart) {
      alertsSent = 0;
    }

    const selection = selectCreditAlertThresholds({
      pctLeft,
      alertsSent,
    });

    if (!selection) {
      return;
    }

    const lowestKey = selection.emailKey;
    const nextAlertsSent = alertsSent | selection.markBits;

    // New alert columns may precede generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = admin.from('ai_credit_balances') as any;

    const { data: claimed, error: claimError } = await table
      .update({
        credit_alerts_sent: nextAlertsSent,
        credit_alert_period_start: periodStart,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', params.accountId)
      .eq('period_start', periodStart)
      .eq('credit_alerts_sent', alertsSent)
      .select('account_id')
      .maybeSingle();

    if (claimError) {
      console.warn('[ai-credit-thresholds] claim failed', {
        accountId: params.accountId,
        error: claimError.message,
      });
      return;
    }

    if (!claimed) {
      if (alertPeriod === periodStart) {
        return;
      }

      const { data: retryClaim, error: retryError } = await table
        .update({
          credit_alerts_sent: nextAlertsSent,
          credit_alert_period_start: periodStart,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', params.accountId)
        .eq('period_start', periodStart)
        .is('credit_alert_period_start', null)
        .select('account_id')
        .maybeSingle();

      if (retryError || !retryClaim) {
        return;
      }
    }

    const accountCtx = await loadAccountNotifyContext(params.accountId);
    if (!accountCtx) {
      return;
    }

    const billingPath = accountCtx.isPersonal
      ? toHomeBillingHref(pathsConfig.app.personalAccountBilling)
      : toHomeBillingHref(
          pathsConfig.app.accountBilling,
          accountCtx.slug ?? undefined,
        );

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    const billingUrl = siteUrl
      ? new URL(billingPath, siteUrl).toString()
      : billingPath;

    const remainingLabel = formatCredits(available);
    const limitLabel = formatCredits(limit);
    const workspaceName = accountCtx.name;

    const copy = buildThresholdCopy({
      key: lowestKey,
      workspaceName,
      remainingLabel,
      limitLabel,
      creditsRequired: params.creditsRequired,
    });

    await createInAppNotification({
      accountId: params.accountId,
      type: lowestKey === 'exhausted' ? 'warning' : 'info',
      body: copy.inAppBody,
      link: billingPath,
    });

    if (!accountCtx.ownerEmail) {
      return;
    }

    const sender = process.env.EMAIL_SENDER;
    if (!sender || !siteUrl) {
      console.warn(
        '[ai-credit-thresholds] EMAIL_SENDER or NEXT_PUBLIC_SITE_URL missing',
      );
      return;
    }

    const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
    const html = wrapNotificationEmail(
      `<p style="margin:0 0 12px;">${escapeNotificationHtml(copy.intro)}</p>
<p style="margin:0 0 12px;"><strong>${escapeNotificationHtml(remainingLabel)}</strong> of <strong>${escapeNotificationHtml(limitLabel)}</strong> AI credits left for <strong>${escapeNotificationHtml(workspaceName)}</strong>.</p>
<p style="margin:0;">${escapeNotificationHtml(copy.detail)}</p>`,
      {
        title: copy.subject,
        heading: copy.heading,
        preview: copy.preview,
        cta: { label: copy.ctaLabel, href: billingUrl },
        footerNote: `You are receiving this because you are the primary owner of ${workspaceName} on ${productName}.`,
        productName,
      },
    );

    await sendPlatformEmail({
      type: 'billing',
      accountId: params.accountId,
      mail: {
        to: accountCtx.ownerEmail,
        from: sender,
        subject: copy.subject,
        html,
      },
      metadata: {
        notification_type: `ai_credits_${lowestKey}`,
        remaining: available,
        limit,
        pct_left: Math.round(pctLeft * 10) / 10,
      },
    });
  } catch (error) {
    console.warn('[ai-credit-thresholds] failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Exhausted path used when a debit fails for insufficient credits.
 */
export async function notifyAiCreditsExhausted(params: {
  accountId: string;
  creditsRemaining: number;
  creditsRequired: number;
}): Promise<void> {
  try {
    const admin = getSupabaseServerAdminClient();
    const { data, error } = await admin
      .from('ai_credit_balances')
      .select('*')
      .eq('account_id', params.accountId)
      .maybeSingle();

    if (error || !data) {
      return;
    }

    const balance = data as unknown as AiCreditAlertBalance;
    await notifyAiCreditThresholds({
      accountId: params.accountId,
      balance: {
        ...balance,
        credits_remaining: roundAiCredits(Number(balance.credits_remaining)),
        credits_purchased: roundAiCredits(
          Number(balance.credits_purchased ?? 0),
        ),
        credits_monthly_limit: roundAiCredits(
          Number(balance.credits_monthly_limit),
        ),
      },
      forceExhausted: true,
      creditsRequired: params.creditsRequired,
    });
  } catch (error) {
    console.warn('[ai-credits-notify] failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function formatCredits(value: number): string {
  const rounded = roundAiCredits(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function buildThresholdCopy(input: {
  key: ThresholdKey;
  workspaceName: string;
  remainingLabel: string;
  limitLabel: string;
  creditsRequired?: number;
}): {
  subject: string;
  heading: string;
  preview: string;
  intro: string;
  detail: string;
  ctaLabel: string;
  inAppBody: string;
} {
  const { workspaceName, remainingLabel, limitLabel } = input;

  if (input.key === 'exhausted') {
    const need =
      input.creditsRequired != null
        ? ` (need ${formatCredits(input.creditsRequired)}, have ${remainingLabel})`
        : '';
    return {
      subject: `${workspaceName} is out of AI credits`,
      heading: 'AI credits exhausted',
      preview: `${workspaceName} has no AI credits left this month.`,
      intro: `${workspaceName} has used its AI credit pool for this billing period.`,
      detail:
        'Email assist, task extraction, drafts, and other AI features will pause until you buy more credits or the monthly pool resets.',
      ctaLabel: 'Buy AI credits',
      inAppBody: `${AI_CREDITS_EXHAUSTED_BODY_PREFIX}${need}. Top up to keep using AI features.`,
    };
  }

  if (input.key === 'pct10') {
    return {
      subject: `${workspaceName} AI credits at 10%`,
      heading: 'AI credits running low',
      preview: `${remainingLabel} of ${limitLabel} AI credits left.`,
      intro: `${workspaceName} is down to about 10% of its monthly AI credits.`,
      detail:
        'Email assist, extracts, and drafts will stop when the pool hits zero. Buy more credits to stay ahead.',
      ctaLabel: 'Buy AI credits',
      inAppBody: `AI credits low: ${remainingLabel} left / ${limitLabel}. Buy more in billing.`,
    };
  }

  if (input.key === 'pct25') {
    return {
      subject: `${workspaceName} AI credits at 25%`,
      heading: 'AI credits at 25%',
      preview: `${remainingLabel} of ${limitLabel} AI credits left.`,
      intro: `${workspaceName} has about a quarter of its monthly AI credits remaining.`,
      detail:
        'If usage stays high, consider topping up so email assist and related AI features keep running smoothly.',
      ctaLabel: 'Buy AI credits',
      inAppBody: `AI credits at 25%: ${remainingLabel} left / ${limitLabel}.`,
    };
  }

  return {
    subject: `${workspaceName} AI credits at 50%`,
    heading: 'AI credits halfway used',
    preview: `${remainingLabel} of ${limitLabel} AI credits left.`,
    intro: `${workspaceName} has used about half of its monthly AI credits.`,
    detail:
      'This is an early heads-up only. You can review usage or buy more credits from billing whenever you like.',
    ctaLabel: 'View billing',
    inAppBody: `AI credits at 50%: ${remainingLabel} left / ${limitLabel}.`,
  };
}

async function loadAccountNotifyContext(accountId: string): Promise<{
  name: string;
  slug: string | null;
  isPersonal: boolean;
  ownerEmail: string | null;
} | null> {
  const admin = getSupabaseServerAdminClient();
  const { data: account, error } = await admin
    .from('accounts')
    .select('id, name, slug, is_personal_account, primary_owner_user_id, email')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !account) {
    return null;
  }

  const row = account as {
    name: string | null;
    slug: string | null;
    is_personal_account: boolean;
    primary_owner_user_id: string | null;
    email: string | null;
  };

  let ownerEmail: string | null =
    typeof row.email === 'string' && row.email.includes('@') ? row.email : null;

  const ownerUserId = row.primary_owner_user_id;
  if (ownerUserId) {
    const { data: userResult } =
      await admin.auth.admin.getUserById(ownerUserId);
    if (userResult.user?.email) {
      ownerEmail = userResult.user.email;
    }
  } else {
    const { data: membership } = await admin
      .from('accounts_memberships')
      .select('user_id')
      .eq('account_id', accountId)
      .eq('account_role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const userId = (membership as { user_id?: string } | null)?.user_id;
    if (userId) {
      const { data: userResult } = await admin.auth.admin.getUserById(userId);
      if (userResult.user?.email) {
        ownerEmail = userResult.user.email;
      }
    }
  }

  return {
    name: row.name?.trim() || row.slug?.trim() || 'Your workspace',
    slug: row.slug,
    isPersonal: Boolean(row.is_personal_account),
    ownerEmail,
  };
}
