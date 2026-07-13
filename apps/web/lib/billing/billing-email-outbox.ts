import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import type {
  AccountBillingStatus,
  BillingEmailKind,
} from './account-billing-types';
import { sendBillingLifecycleEmail } from './billing-lifecycle-emails';

type AnyClient = SupabaseClient<any>;

function outbox(client: AnyClient) {
  return client.from('billing_email_outbox');
}

export type BillingEmailPayload = {
  accountSlug?: string;
  accountName?: string;
  subscriptionId?: string | null;
  trialEndsAt?: string | null;
  [key: string]: unknown;
};

/**
 * Enqueue a billing email for async send.
 * Idempotent when stripeEventId is provided (unique on event + kind).
 */
export async function enqueueBillingEmail(
  admin: AnyClient,
  input: {
    accountId: string;
    emailKind: BillingEmailKind;
    payload?: BillingEmailPayload;
    stripeEventId?: string | null;
  },
): Promise<{ enqueued: boolean; id?: string }> {
  const logger = await getLogger();
  const row = {
    account_id: input.accountId,
    email_kind: input.emailKind,
    payload: input.payload ?? {},
    status: 'pending',
    stripe_event_id: input.stripeEventId ?? null,
  };

  const { data, error } = await outbox(admin)
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    // Unique violation → already queued for this Stripe event + kind
    if (error.code === '23505') {
      return { enqueued: false };
    }

    logger.error(
      { error, accountId: input.accountId, emailKind: input.emailKind },
      '[billing-email-outbox] enqueue failed',
    );
    throw error;
  }

  return { enqueued: true, id: data?.id as string | undefined };
}

/**
 * Flush one outbox row via ZeptoMail (sendBillingLifecycleEmail).
 * Dedupes with billing_notification_log so webhook + cron cannot double-send.
 */
export async function flushBillingEmailJob(
  admin: AnyClient,
  jobId: string,
): Promise<void> {
  const logger = await getLogger();

  const { data: job, error } = await outbox(admin)
    .update({ status: 'processing' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id, account_id, email_kind, payload, stripe_event_id')
    .maybeSingle();

  if (error) {
    logger.error({ error, jobId }, '[billing-email-outbox] claim failed');
    return;
  }

  if (!job) {
    return;
  }

  try {
    const payload = (job.payload ?? {}) as BillingEmailPayload;
    const accountId = job.account_id as string;
    const emailKind = job.email_kind as BillingEmailKind;

    let accountSlug = payload.accountSlug;
    let accountName = payload.accountName;

    if (!accountSlug || !accountName) {
      const { data: account } = await admin
        .from('accounts')
        .select('name, slug')
        .eq('id', accountId)
        .maybeSingle();

      accountSlug = accountSlug ?? (account?.slug as string | undefined);
      accountName =
        accountName ??
        ((account?.name as string | null) ?? accountSlug ?? 'Workspace');
    }

    if (!accountSlug) {
      await outbox(admin)
        .update({
          status: 'skipped',
          processed_at: new Date().toISOString(),
          error: 'Account slug missing',
        })
        .eq('id', jobId);
      return;
    }

    const subscriptionId =
      (payload.subscriptionId as string | null | undefined) ??
      `account:${accountId}`;

    const outcome = await sendBillingLifecycleEmail(admin, {
      accountId,
      emailKind,
      accountName: accountName ?? accountSlug,
      accountSlug,
      subscriptionId,
      trialEndsAt: payload.trialEndsAt ?? null,
    });

    await outbox(admin)
      .update({
        status: outcome === 'sent' ? 'sent' : 'skipped',
        processed_at: new Date().toISOString(),
        error: outcome === 'skipped' ? 'Already sent or no owner email' : null,
      })
      .eq('id', jobId);

    logger.info(
      {
        jobId,
        accountId,
        emailKind,
        outcome,
        stripeEventId: job.stripe_event_id,
      },
      '[billing-email-outbox] flushed',
    );
  } catch (err) {
    logger.error({ err, jobId }, '[billing-email-outbox] flush failed');
    await outbox(admin)
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      })
      .eq('id', jobId);
  }
}

export async function flushBillingEmailJobs(
  admin: AnyClient,
  jobIds: string[],
): Promise<void> {
  for (const id of jobIds) {
    await flushBillingEmailJob(admin, id);
  }
}

/** @internal exported for tests / lifecycle helpers */
export type { AccountBillingStatus };
