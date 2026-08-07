import 'server-only';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type ClientCreditSourceType,
  clampClientCreditBalance,
  grantClientCredits,
} from '~/lib/credits/client-credit-ledger';

type RolloverPolicy = 'expire' | 'rollover' | 'cap';

type InvoiceCreditMetadata = {
  credit_topup_units?: number;
  credit_grant_source?: ClientCreditSourceType;
  plan_template_id?: string;
  credits_per_cycle?: number;
  rollover_policy?: RolloverPolicy;
  rollover_cap?: number | null;
  credit_topup_expiry_months?: number;
};

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function endOfNextCalendarMonth(from: Date): Date {
  // Cycle end = last moment of the month after `from`'s month.
  return new Date(from.getFullYear(), from.getMonth() + 2, 0, 23, 59, 59, 999);
}

function asMetadata(value: unknown): InvoiceCreditMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as InvoiceCreditMetadata;
}

function asPolicy(value: unknown): RolloverPolicy {
  if (value === 'rollover' || value === 'cap' || value === 'expire')
    return value;
  return 'expire';
}

/**
 * Grant retainer or top-up credits when an invoice becomes fully paid.
 * Idempotent on invoices.id → client_credit_batches.related_invoice_id.
 */
export async function maybeGrantCreditsOnInvoicePaid(input: {
  accountId: string;
  invoiceId: string;
}): Promise<{ granted: boolean; units: number; reason: string }> {
  const logger = await getLogger();
  const admin = adminDb();

  const { data: invoice, error } = await admin
    .from('invoices')
    .select(
      'id, account_id, client_id, status, paid_at, recurring_series_id, metadata, notes',
    )
    .eq('id', input.invoiceId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error || !invoice) {
    return { granted: false, units: 0, reason: 'invoice_not_found' };
  }

  if (invoice.status !== 'paid' && !invoice.paid_at) {
    return { granted: false, units: 0, reason: 'not_paid' };
  }

  const metadata = asMetadata(invoice.metadata);

  let clientOrgId: string | null = null;
  if (invoice.client_id) {
    const { data: client } = await admin
      .from('clients')
      .select('id, client_org_id')
      .eq('id', invoice.client_id)
      .eq('account_id', input.accountId)
      .maybeSingle();
    clientOrgId = (client?.client_org_id as string | null) ?? null;
  }

  let amount = 0;
  let sourceType: ClientCreditSourceType | null = null;
  let policy: RolloverPolicy = 'expire';
  let rolloverCap: number | null = null;
  let expiresAt: Date | null = null;
  let topupMonths = 6;

  // Path A: one-off top-up invoice metadata
  if (
    typeof metadata.credit_topup_units === 'number' &&
    metadata.credit_topup_units > 0
  ) {
    amount = Math.floor(metadata.credit_topup_units);
    sourceType = 'topup_purchase';
    topupMonths =
      typeof metadata.credit_topup_expiry_months === 'number' &&
      metadata.credit_topup_expiry_months > 0
        ? Math.floor(metadata.credit_topup_expiry_months)
        : 6;
    expiresAt = addMonths(new Date(), topupMonths);
  }

  // Path B: stamped retainer grant metadata (from recurring issue)
  if (
    !sourceType &&
    typeof metadata.credits_per_cycle === 'number' &&
    metadata.credits_per_cycle > 0
  ) {
    amount = Math.floor(metadata.credits_per_cycle);
    sourceType = 'retainer_grant';
    policy = asPolicy(metadata.rollover_policy);
    rolloverCap =
      typeof metadata.rollover_cap === 'number' ? metadata.rollover_cap : null;
  }

  // Path C: resolve via recurring series → subscription → plan_template
  if (!sourceType && invoice.recurring_series_id) {
    const { data: series } = await admin
      .from('invoice_recurring_series')
      .select('id, client_subscription_id, template')
      .eq('id', invoice.recurring_series_id)
      .maybeSingle();

    const template = asMetadata(
      (series?.template as Record<string, unknown> | null)?.credit_grant ??
        (series?.template as Record<string, unknown> | null),
    );

    let planTemplateId =
      typeof template.plan_template_id === 'string'
        ? template.plan_template_id
        : typeof metadata.plan_template_id === 'string'
          ? metadata.plan_template_id
          : null;

    if (!planTemplateId && series?.client_subscription_id) {
      const { data: sub } = await admin
        .from('client_subscriptions')
        .select('id, plan_template_id, client_org_id')
        .eq('id', series.client_subscription_id)
        .maybeSingle();
      planTemplateId = (sub?.plan_template_id as string | null) ?? null;
      if (!clientOrgId) {
        clientOrgId = (sub?.client_org_id as string | null) ?? null;
      }
    }

    if (planTemplateId) {
      const { data: plan } = await admin
        .from('plan_templates')
        .select(
          'id, credits_per_cycle, rollover_policy, rollover_cap, account_id',
        )
        .eq('id', planTemplateId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (
        plan &&
        typeof plan.credits_per_cycle === 'number' &&
        plan.credits_per_cycle > 0
      ) {
        amount = Math.floor(plan.credits_per_cycle);
        sourceType = 'retainer_grant';
        policy = asPolicy(plan.rollover_policy);
        rolloverCap =
          typeof plan.rollover_cap === 'number' ? plan.rollover_cap : null;
      }
    }
  }

  // Path D: active subscription on invoice client with credits_per_cycle
  if (!sourceType && invoice.client_id) {
    const { data: sub } = await admin
      .from('client_subscriptions')
      .select(
        'id, client_org_id, plan_template_id, status, plan_templates(credits_per_cycle, rollover_policy, rollover_cap)',
      )
      .eq('account_id', input.accountId)
      .eq('client_id', invoice.client_id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const plan = Array.isArray(sub?.plan_templates)
      ? sub?.plan_templates[0]
      : sub?.plan_templates;

    if (
      plan &&
      typeof (plan as { credits_per_cycle?: number }).credits_per_cycle ===
        'number' &&
      (plan as { credits_per_cycle: number }).credits_per_cycle > 0
    ) {
      amount = Math.floor(
        (plan as { credits_per_cycle: number }).credits_per_cycle,
      );
      sourceType = 'retainer_grant';
      policy = asPolicy((plan as { rollover_policy?: string }).rollover_policy);
      rolloverCap =
        typeof (plan as { rollover_cap?: number }).rollover_cap === 'number'
          ? (plan as { rollover_cap: number }).rollover_cap
          : null;
      if (!clientOrgId) {
        clientOrgId = (sub?.client_org_id as string | null) ?? null;
      }
    }
  }

  if (!sourceType || amount <= 0) {
    return { granted: false, units: 0, reason: 'no_credit_grant' };
  }

  if (!clientOrgId) {
    logger.warn(
      {
        name: 'client.credits.grant.skip',
        invoiceId: input.invoiceId,
        accountId: input.accountId,
      },
      'Invoice paid but client has no client_org_id — cannot grant credits',
    );
    return { granted: false, units: 0, reason: 'missing_client_org' };
  }

  if (sourceType === 'retainer_grant') {
    if (policy === 'expire') {
      expiresAt = endOfNextCalendarMonth(new Date());
    } else {
      expiresAt = null;
    }
  }

  const result = await grantClientCredits({
    clientOrgId,
    accountId: input.accountId,
    amount,
    sourceType,
    expiresAt,
    relatedInvoiceId: input.invoiceId,
  });

  if (policy === 'cap' && typeof rolloverCap === 'number' && rolloverCap >= 0) {
    await clampClientCreditBalance({
      clientOrgId,
      cap: rolloverCap,
    });
  }

  await admin.from('invoice_events').insert({
    account_id: input.accountId,
    invoice_id: input.invoiceId,
    event_type: 'credits_granted',
    payload: {
      units: result.granted ?? amount,
      source_type: sourceType,
      batch_id: result.batch_id ?? null,
      expires_at: result.expires_at ?? expiresAt?.toISOString() ?? null,
      idempotent: result.idempotent ?? false,
      client_org_id: clientOrgId,
      rollover_policy: policy,
      rollover_cap: rolloverCap,
    },
    actor_id: null,
  });

  logger.info(
    {
      name: 'client.credits.grant',
      invoiceId: input.invoiceId,
      accountId: input.accountId,
      clientOrgId,
      units: result.granted ?? amount,
      sourceType,
      idempotent: result.idempotent ?? false,
    },
    'Granted client credits on invoice paid',
  );

  return {
    granted: true,
    units: result.granted ?? amount,
    reason: result.idempotent ? 'idempotent' : 'granted',
  };
}

/** Stamp credit grant metadata onto a newly issued recurring invoice. */
export async function stampRecurringInvoiceCreditMetadata(input: {
  accountId: string;
  invoiceId: string;
  seriesId: string;
}): Promise<void> {
  const admin = adminDb();

  const { data: series } = await admin
    .from('invoice_recurring_series')
    .select('id, client_subscription_id, template')
    .eq('id', input.seriesId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (!series) return;

  const templateRoot = (series.template ?? {}) as Record<string, unknown>;
  const creditGrant = asMetadata(templateRoot.credit_grant ?? templateRoot);

  let planTemplateId =
    typeof creditGrant.plan_template_id === 'string'
      ? creditGrant.plan_template_id
      : null;

  if (!planTemplateId && series.client_subscription_id) {
    const { data: sub } = await admin
      .from('client_subscriptions')
      .select('plan_template_id')
      .eq('id', series.client_subscription_id)
      .maybeSingle();
    planTemplateId = (sub?.plan_template_id as string | null) ?? null;
  }

  if (!planTemplateId) return;

  const { data: plan } = await admin
    .from('plan_templates')
    .select('credits_per_cycle, rollover_policy, rollover_cap')
    .eq('id', planTemplateId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (
    !plan ||
    typeof plan.credits_per_cycle !== 'number' ||
    plan.credits_per_cycle <= 0
  ) {
    return;
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('metadata')
    .eq('id', input.invoiceId)
    .maybeSingle();

  const metadata = {
    ...asMetadata(invoice?.metadata),
    credit_grant_source: 'retainer_grant' as const,
    plan_template_id: planTemplateId,
    credits_per_cycle: plan.credits_per_cycle,
    rollover_policy: asPolicy(plan.rollover_policy),
    rollover_cap:
      typeof plan.rollover_cap === 'number' ? plan.rollover_cap : null,
  };

  await admin
    .from('invoices')
    .update({ metadata })
    .eq('id', input.invoiceId)
    .eq('account_id', input.accountId);
}
