import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/**
 * Ensure a native invoice_recurring_series exists for an active retainer-style
 * client_subscription (native invoicing path — not Stripe Billing).
 *
 * Idempotent: returns the existing series when already linked.
 */
export async function ensureRetainerRecurringSeries(input: {
  accountId: string;
  subscriptionId: string;
  /** When omitted, uses subscription.next_billing_date or tomorrow. */
  nextIssueAt?: string;
  frequency?: 'monthly' | 'yearly';
  autoSend?: boolean;
}): Promise<{ seriesId: string; created: boolean }> {
  const admin = getSupabaseServerAdminClient() as any;

  const { data: existing } = await admin
    .from('invoice_recurring_series')
    .select('id')
    .eq('account_id', input.accountId)
    .eq('client_subscription_id', input.subscriptionId)
    .eq('status', 'active')
    .maybeSingle();

  if (existing?.id) {
    return { seriesId: existing.id as string, created: false };
  }

  const { data: sub, error: subError } = await admin
    .from('client_subscriptions')
    .select(
      'id, account_id, client_id, plan_template_id, plan_name, monthly_amount, currency, next_billing_date, status, subscription_kind',
    )
    .eq('id', input.subscriptionId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (subError || !sub) {
    throw new Error('Subscription not found');
  }

  if (!sub.client_id) {
    throw new Error(
      'Subscription needs a client_id before creating a recurring invoice series',
    );
  }

  const { data: plan } = sub.plan_template_id
    ? await admin
        .from('plan_templates')
        .select(
          'id, name, amount, monthly_amount, currency, billing_interval, credits_per_cycle, rollover_policy, rollover_cap',
        )
        .eq('id', sub.plan_template_id)
        .maybeSingle()
    : { data: null };

  const amountPence = Math.round(
    Number(
      plan?.amount ??
        (typeof plan?.monthly_amount === 'number'
          ? Math.round(Number(plan.monthly_amount) * 100)
          : 0) ??
        (typeof sub.monthly_amount === 'number'
          ? Math.round(Number(sub.monthly_amount) * 100)
          : 0),
    ),
  );

  const currency = String(
    plan?.currency ?? sub.currency ?? 'gbp',
  ).toLowerCase();
  const frequency =
    input.frequency ??
    (plan?.billing_interval === 'year' ? 'yearly' : 'monthly');

  const nextIssueAt =
    input.nextIssueAt ??
    (sub.next_billing_date
      ? new Date(sub.next_billing_date).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  const title = `${sub.plan_name || plan?.name || 'Retainer'} — recurring`;

  const template = {
    title,
    notes: title,
    items: [
      {
        description: title,
        quantity: 1,
        unit_price_pence: amountPence,
        line_type: 'quantity',
      },
    ],
    credit_grant: plan
      ? {
          plan_template_id: plan.id,
          credits_per_cycle: plan.credits_per_cycle ?? null,
          rollover_policy: plan.rollover_policy ?? 'expire',
          rollover_cap: plan.rollover_cap ?? null,
        }
      : null,
  };

  const { data: series, error } = await admin
    .from('invoice_recurring_series')
    .insert({
      account_id: input.accountId,
      client_id: sub.client_id,
      client_subscription_id: sub.id,
      title,
      currency,
      frequency,
      next_issue_at: nextIssueAt,
      auto_send: input.autoSend ?? true,
      status: 'active',
      template,
      due_days: 7,
    })
    .select('id')
    .single();

  if (error || !series) {
    throw new Error(error?.message || 'Failed to create recurring series');
  }

  return { seriesId: series.id as string, created: true };
}
