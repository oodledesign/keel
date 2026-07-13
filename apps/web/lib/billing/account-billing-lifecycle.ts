import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  BILLING_GRACE_PERIOD_DAYS,
  type AccountBillingRow,
  type AccountBillingStatus,
  type BillingEmailKind,
} from './account-billing-types';
import {
  enqueueBillingEmail,
  type BillingEmailPayload,
} from './billing-email-outbox';

type AnyClient = SupabaseClient<any>;

function billingTable(client: AnyClient) {
  return client.from('account_billing');
}

function eventsTable(client: AnyClient) {
  return client.from('billing_events');
}

function customersTable(client: AnyClient) {
  return client.from('billing_customers');
}

function accountsTable(client: AnyClient) {
  return client.from('accounts');
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export type BillingTransitionResult = {
  applied: boolean;
  reason?: string;
  accountId?: string;
  fromStatus?: AccountBillingStatus | null;
  toStatus?: AccountBillingStatus;
  emailJobIds: string[];
};

async function findAccountIdByStripeCustomerId(
  admin: AnyClient,
  stripeCustomerId: string,
): Promise<string | null> {
  const { data: billingRow } = await billingTable(admin)
    .select('account_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (billingRow?.account_id) {
    return billingRow.account_id as string;
  }

  const { data: customer } = await customersTable(admin)
    .select('account_id')
    .eq('customer_id', stripeCustomerId)
    .eq('provider', 'stripe')
    .maybeSingle();

  return (customer?.account_id as string | null) ?? null;
}

async function loadAccountBilling(
  admin: AnyClient,
  accountId: string,
): Promise<AccountBillingRow | null> {
  const { data } = await billingTable(admin)
    .select(
      'account_id, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, grace_period_ends_at, restricted_at, suspended_at, canceled_at',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  return (data as AccountBillingRow | null) ?? null;
}

async function loadAccountMeta(
  admin: AnyClient,
  accountId: string,
): Promise<{ name: string; slug: string } | null> {
  const { data } = await accountsTable(admin)
    .select('name, slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!data?.slug) {
    return null;
  }

  return {
    name: (data.name as string | null) ?? (data.slug as string),
    slug: data.slug as string,
  };
}

async function eventAlreadyProcessed(
  admin: AnyClient,
  stripeEventId: string,
): Promise<boolean> {
  const { data } = await eventsTable(admin)
    .select('id')
    .eq('stripe_event_id', stripeEventId)
    .maybeSingle();

  return Boolean(data);
}

function patchForStatus(
  toStatus: AccountBillingStatus,
  now: Date,
  existing: AccountBillingRow | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    subscription_status: toStatus,
  };

  switch (toStatus) {
    case 'past_due_grace': {
      if (!existing?.grace_period_ends_at) {
        patch.grace_period_ends_at = addDays(
          now,
          BILLING_GRACE_PERIOD_DAYS,
        ).toISOString();
      }
      patch.restricted_at = null;
      patch.suspended_at = null;
      patch.canceled_at = null;
      break;
    }
    case 'past_due_restricted': {
      patch.restricted_at = existing?.restricted_at ?? now.toISOString();
      break;
    }
    case 'suspended': {
      patch.suspended_at = existing?.suspended_at ?? now.toISOString();
      break;
    }
    case 'canceled': {
      patch.canceled_at = existing?.canceled_at ?? now.toISOString();
      break;
    }
    case 'active':
    case 'trialing': {
      patch.grace_period_ends_at = null;
      patch.restricted_at = null;
      patch.suspended_at = null;
      patch.canceled_at = null;
      break;
    }
    case 'trial_expired': {
      break;
    }
    default:
      break;
  }

  return patch;
}

/**
 * Apply an Ozer account_billing status transition with Stripe event idempotency.
 * Enqueues emails; does not send them inline.
 */
export async function applyAccountBillingTransition(
  admin: AnyClient,
  input: {
    stripeEventId: string;
    stripeCustomerId?: string | null;
    /** Prefer when known (cron). Otherwise resolved from stripeCustomerId. */
    accountId?: string;
    stripeSubscriptionId?: string | null;
    trialEndsAt?: string | null;
    toStatus: AccountBillingStatus;
    emailKind?: BillingEmailKind | null;
    emailPayload?: BillingEmailPayload;
    /** Force write even if status unchanged (still records event once). */
    forceEvent?: boolean;
  },
): Promise<BillingTransitionResult> {
  const logger = await getLogger();
  const emailJobIds: string[] = [];

  if (await eventAlreadyProcessed(admin, input.stripeEventId)) {
    return { applied: false, reason: 'duplicate_stripe_event', emailJobIds };
  }

  let accountId = input.accountId ?? null;
  if (!accountId && input.stripeCustomerId) {
    accountId = await findAccountIdByStripeCustomerId(
      admin,
      input.stripeCustomerId,
    );
  }

  if (!accountId) {
    logger.warn(
      {
        stripeCustomerId: input.stripeCustomerId,
        stripeEventId: input.stripeEventId,
      },
      '[account-billing] no account for stripe customer',
    );
    return { applied: false, reason: 'account_not_found', emailJobIds };
  }

  const existing = await loadAccountBilling(admin, accountId);
  const fromStatus = existing?.subscription_status ?? null;
  const now = new Date();

  if (
    !input.forceEvent &&
    fromStatus === input.toStatus &&
    !input.emailKind
  ) {
    // Still record the event so redeliveries are no-ops
    const { error: noopEventError } = await eventsTable(admin).insert({
      account_id: accountId,
      from_status: fromStatus,
      to_status: input.toStatus,
      stripe_event_id: input.stripeEventId,
    });

    if (noopEventError?.code === '23505') {
      return { applied: false, reason: 'duplicate_stripe_event', emailJobIds };
    }

    return {
      applied: false,
      reason: 'status_unchanged',
      accountId,
      fromStatus,
      toStatus: input.toStatus,
      emailJobIds,
    };
  }

  const stripeCustomerId =
    input.stripeCustomerId ?? existing?.stripe_customer_id ?? null;

  const patch = {
    account_id: accountId,
    ...patchForStatus(input.toStatus, now, existing),
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(input.stripeSubscriptionId
      ? { stripe_subscription_id: input.stripeSubscriptionId }
      : {}),
    ...(input.trialEndsAt !== undefined
      ? { trial_ends_at: input.trialEndsAt }
      : {}),
  };

  const { error: upsertError } = await billingTable(admin).upsert(patch, {
    onConflict: 'account_id',
  });

  if (upsertError) {
    logger.error(
      { upsertError, accountId, stripeEventId: input.stripeEventId },
      '[account-billing] upsert failed',
    );
    throw upsertError;
  }

  const { error: eventError } = await eventsTable(admin).insert({
    account_id: accountId,
    from_status: fromStatus,
    to_status: input.toStatus,
    stripe_event_id: input.stripeEventId,
  });

  if (eventError) {
    if (eventError.code === '23505') {
      return {
        applied: false,
        reason: 'duplicate_stripe_event',
        accountId,
        fromStatus,
        toStatus: input.toStatus,
        emailJobIds,
      };
    }
    throw eventError;
  }

  if (input.emailKind) {
    const meta = await loadAccountMeta(admin, accountId);
    const queued = await enqueueBillingEmail(admin, {
      accountId,
      emailKind: input.emailKind,
      stripeEventId: input.stripeEventId,
      payload: {
        accountSlug: meta?.slug,
        accountName: meta?.name,
        subscriptionId: input.stripeSubscriptionId ?? existing?.stripe_subscription_id,
        trialEndsAt: input.trialEndsAt ?? existing?.trial_ends_at,
        fromStatus,
        toStatus: input.toStatus,
        ...input.emailPayload,
      },
    });

    if (queued.enqueued && queued.id) {
      emailJobIds.push(queued.id);
    }
  }

  logger.info(
    {
      accountId,
      fromStatus,
      toStatus: input.toStatus,
      stripeEventId: input.stripeEventId,
      emailJobIds,
    },
    '[account-billing] transition applied',
  );

  return {
    applied: true,
    accountId,
    fromStatus,
    toStatus: input.toStatus,
    emailJobIds,
  };
}

/**
 * Map Stripe subscription.status → Ozer account_billing_status.
 */
export function mapStripeSubscriptionStatus(
  stripeStatus: string,
  current: AccountBillingStatus | null,
): AccountBillingStatus | null {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      // Preserve restricted/suspended if already escalated by cron
      if (
        current === 'past_due_restricted' ||
        current === 'suspended' ||
        current === 'canceled'
      ) {
        return current;
      }
      return 'past_due_grace';
    case 'unpaid':
      if (current === 'suspended' || current === 'canceled') {
        return current;
      }
      return 'past_due_restricted';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return null;
  }
}

/**
 * Idempotent milestone marker in billing_events (same status → same status).
 * Used so cron email-only sends are recorded once even if notification_log differs.
 */
export function billingEmailEventId(
  accountId: string,
  emailKind: BillingEmailKind,
) {
  return `cron-email:${accountId}:${emailKind}`;
}

export async function claimBillingEmailEvent(
  admin: AnyClient,
  input: {
    accountId: string;
    emailKind: BillingEmailKind;
    status: AccountBillingStatus | null;
  },
): Promise<boolean> {
  const stripeEventId = billingEmailEventId(input.accountId, input.emailKind);

  if (await eventAlreadyProcessed(admin, stripeEventId)) {
    return false;
  }

  const status = input.status ?? 'trialing';
  const { error } = await eventsTable(admin).insert({
    account_id: input.accountId,
    from_status: status,
    to_status: status,
    stripe_event_id: stripeEventId,
  });

  if (error?.code === '23505') {
    return false;
  }

  if (error) {
    throw error;
  }

  return true;
}

/** Allow retry if the send failed after claiming the milestone event. */
export async function releaseBillingEmailEvent(
  admin: AnyClient,
  accountId: string,
  emailKind: BillingEmailKind,
): Promise<void> {
  await eventsTable(admin)
    .delete()
    .eq('stripe_event_id', billingEmailEventId(accountId, emailKind));
}

export {
  eventAlreadyProcessed,
  findAccountIdByStripeCustomerId,
  loadAccountBilling,
  loadAccountMeta,
};
