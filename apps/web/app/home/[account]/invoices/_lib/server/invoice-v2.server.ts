import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';

import { normalizeInvoiceCurrency } from '../invoice-currency';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  DEFAULT_INVOICE_FOOTER_MESSAGE,
} from '../invoice-smart-fields';
import { computeInvoiceTotals, isInvoiceOverdue } from '../invoice-totals';
import { sendInvoiceIssuedEmail } from './invoice-notifications';
import { createInvoicesService } from './invoices.service';

function db() {
  return getSupabaseServerClient() as any;
}

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export async function recomputeInvoiceTotals(invoiceId: string) {
  const client = db();
  const { data: invoice, error } = await client
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) throw new Error('Invoice not found');

  const { data: items } = await client
    .from('invoice_items')
    .select('total_pence')
    .eq('invoice_id', invoiceId);
  const subtotal = (items ?? []).reduce(
    (sum: number, row: { total_pence: number }) => sum + row.total_pence,
    0,
  );

  const totals = computeInvoiceTotals({
    subtotal_pence: subtotal,
    discount_type: invoice.discount_type,
    discount_value: invoice.discount_value,
    tax_rate_bp: invoice.tax_rate_bp,
    late_fee_type: invoice.late_fee_type,
    late_fee_value: invoice.late_fee_value,
    deposit_type: invoice.deposit_type,
    deposit_value: invoice.deposit_value,
    due_at: invoice.due_at,
    status: invoice.status,
  });

  const { error: updateError } = await client
    .from('invoices')
    .update({
      subtotal_pence: totals.subtotal_pence,
      total_pence: totals.total_pence,
    })
    .eq('id', invoiceId);
  if (updateError) throw new Error(updateError.message);
  return totals;
}

export async function getInvoiceSummary(
  accountId: string,
  period: 'month_to_date' | 'last_30_days' | 'last_90_days' = 'month_to_date',
) {
  const client = db();
  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'last_30_days') {
    from = new Date(now);
    from.setDate(from.getDate() - 30);
  } else if (period === 'last_90_days') {
    from = new Date(now);
    from.setDate(from.getDate() - 90);
  }

  const [{ data, error }, displayCurrency] = await Promise.all([
    client
      .from('invoices')
      .select(
        'status, total_pence, amount_paid_pence, issued_at, due_at, archived_at, currency',
      )
      .eq('account_id', accountId)
      .is('archived_at', null)
      .gte('issued_at', from.toISOString()),
    getWorkspaceCurrencyWithClient(client, accountId),
  ]);
  if (error) throw new Error(error.message);

  const normalizedDisplayCurrency = normalizeInvoiceCurrency(displayCurrency);

  const currencies = new Set(
    (data ?? []).map((row: { currency?: string | null }) =>
      normalizeInvoiceCurrency(row.currency),
    ),
  );
  const mixedCurrencies = currencies.size > 1;

  let issued = 0;
  let paid = 0;
  let unpaid = 0;
  let overdue = 0;
  const byDay = new Map<string, number>();

  for (const row of data ?? []) {
    const rowCurrency = normalizeInvoiceCurrency(
      (row as { currency?: string | null }).currency,
    );
    if (rowCurrency !== normalizedDisplayCurrency) continue;

    const total = row.total_pence ?? 0;
    const amountPaid = row.amount_paid_pence ?? 0;
    if (['sent', 'read', 'paid', 'overdue'].includes(row.status)) {
      issued += total;
    }
    if (row.status === 'paid') {
      paid += total;
    } else if (['sent', 'read'].includes(row.status)) {
      unpaid += total - amountPaid;
      if (isInvoiceOverdue(row)) overdue += total - amountPaid;
    }
    if (row.issued_at) {
      const day = row.issued_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + total);
    }
  }

  return {
    issued_pence: issued,
    paid_pence: paid,
    unpaid_pence: unpaid,
    overdue_pence: overdue,
    currency: normalizedDisplayCurrency,
    mixed_currencies: mixedCurrencies,
    chart: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount_pence]) => ({ date, amount_pence })),
  };
}

export async function getInvoiceTabCounts(accountId: string) {
  const client = db();
  const { data, error } = await client
    .from('invoices')
    .select('status, due_at, amount_paid_pence, total_pence, archived_at')
    .eq('account_id', accountId)
    .is('archived_at', null);
  if (error) throw new Error(error.message);

  let draft = 0;
  let unpaid = 0;
  for (const row of data ?? []) {
    if (row.status === 'draft') draft += 1;
    if (['sent', 'read'].includes(row.status)) {
      const remaining = (row.total_pence ?? 0) - (row.amount_paid_pence ?? 0);
      if (remaining > 0) unpaid += 1;
    }
  }

  const { count: recurringCount } = await client
    .from('invoice_recurring_series')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .neq('status', 'ended');

  return {
    draft,
    unpaid,
    all: data?.length ?? 0,
    recurring: recurringCount ?? 0,
  };
}

export async function duplicateInvoice(accountId: string, invoiceId: string) {
  const service = createInvoicesService(getSupabaseServerClient());
  const source = await service.getInvoice({ accountId, invoiceId });
  if (!source) throw new Error('Invoice not found');

  const created = await service.createInvoice({
    accountId,
    client_id: source.client_id,
    due_at: source.due_at,
    notes: source.notes,
    title: source.title,
    reference_number: source.reference_number,
    currency: normalizeInvoiceCurrency(source.currency),
  });

  await db()
    .from('invoices')
    .update({
      currency: source.currency,
      discount_type: source.discount_type,
      discount_value: source.discount_value,
      tax_rate_bp: source.tax_rate_bp,
      deposit_type: source.deposit_type,
      deposit_value: source.deposit_value,
      late_fee_type: source.late_fee_type,
      late_fee_value: source.late_fee_value,
      footer_message: source.footer_message,
      private_note: source.private_note,
      email_subject: source.email_subject,
      email_body: source.email_body,
      email_signature: source.email_signature,
    })
    .eq('id', created.id);

  if (source.items?.length) {
    await service.upsertInvoiceItems({
      accountId,
      invoiceId: created.id,
      items: source.items.map((item: any, index: number) => ({
        job_id: item.job_id,
        sort_order: index,
        description: item.description,
        description_detail: item.description_detail,
        quantity: item.quantity,
        unit_price_pence: item.unit_price_pence,
        total_pence: item.total_pence,
      })),
    });
  }

  return created;
}

export async function archiveInvoice(
  accountId: string,
  invoiceId: string,
  archived: boolean,
) {
  const { error } = await db()
    .from('invoices')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('account_id', accountId)
    .eq('id', invoiceId);
  if (error) throw new Error(error.message);
}

export async function voidInvoice(accountId: string, invoiceId: string) {
  const service = createInvoicesService(getSupabaseServerClient());
  const invoice = await service.getInvoice({ accountId, invoiceId });
  if (!invoice) throw new Error('Invoice not found');
  if (!['sent', 'read'].includes(invoice.status)) {
    throw new Error('Only sent invoices can be voided');
  }
  const { error } = await db()
    .from('invoices')
    .update({ status: 'void', paid_at: null })
    .eq('id', invoiceId)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
}

export async function resendInvoice(accountId: string, invoiceId: string) {
  const invoice = await db()
    .from('invoices')
    .select('id, status, sent_to_email')
    .eq('account_id', accountId)
    .eq('id', invoiceId)
    .single();
  if (invoice.error || !invoice.data) throw new Error('Invoice not found');
  if (!['sent', 'read'].includes(invoice.data.status)) {
    throw new Error('Only sent invoices can be resent');
  }
  const email = invoice.data.sent_to_email;
  if (!email) throw new Error('No recipient email on file');

  await sendInvoiceIssuedEmail({
    accountId,
    invoiceId,
    recipientEmail: email,
  });
}

export async function markInvoiceReadByToken(token: string) {
  const admin = adminDb();
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status, read_at')
    .eq('public_token', token)
    .maybeSingle();
  if (!invoice || invoice.status !== 'sent' || invoice.read_at) return;

  await admin
    .from('invoices')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('id', invoice.id);
}

export async function recordInvoicePayment(input: {
  accountId: string;
  invoiceId: string;
  amount_pence: number;
  payment_method: 'stripe' | 'bank_transfer' | 'cash';
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  actorId?: string | null;
}) {
  const admin = adminDb();
  const { data: invoice, error } = await admin
    .from('invoices')
    .select(
      'id, account_id, status, total_pence, amount_paid_pence, deposit_type, deposit_value',
    )
    .eq('id', input.invoiceId)
    .eq('account_id', input.accountId)
    .single();
  if (error || !invoice) throw new Error('Invoice not found');

  await admin.from('invoice_payments').insert({
    account_id: input.accountId,
    invoice_id: input.invoiceId,
    amount_pence: input.amount_pence,
    payment_method: input.payment_method,
    stripe_checkout_session_id: input.stripe_checkout_session_id ?? null,
    stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
    created_by: input.actorId ?? null,
  });

  const amountPaid = (invoice.amount_paid_pence ?? 0) + input.amount_pence;
  const fullyPaid = amountPaid >= (invoice.total_pence ?? 0);
  const patch: Record<string, unknown> = { amount_paid_pence: amountPaid };
  if (fullyPaid) {
    patch.status = 'paid';
    patch.paid_at = new Date().toISOString();
  }

  await admin.from('invoices').update(patch).eq('id', input.invoiceId);
  return { amountPaid, fullyPaid };
}

export async function listRecurringSeries(accountId: string) {
  const { data, error } = await db()
    .from('invoice_recurring_series')
    .select('*, clients(display_name)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertRecurringSeries(input: {
  accountId: string;
  seriesId?: string;
  client_id: string;
  title: string;
  currency: string;
  frequency: string;
  next_issue_at: string;
  end_at?: string | null;
  max_occurrences?: number | null;
  auto_send: boolean;
  template: Record<string, unknown>;
}) {
  const payload = {
    account_id: input.accountId,
    client_id: input.client_id,
    title: input.title,
    currency: input.currency,
    frequency: input.frequency,
    next_issue_at: input.next_issue_at,
    end_at: input.end_at ?? null,
    max_occurrences: input.max_occurrences ?? null,
    auto_send: input.auto_send,
    template: input.template,
    status: 'active',
  };

  if (input.seriesId) {
    const { data, error } = await db()
      .from('invoice_recurring_series')
      .update(payload)
      .eq('id', input.seriesId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await db()
    .from('invoice_recurring_series')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRecurringSeriesStatus(
  accountId: string,
  seriesId: string,
  status: 'active' | 'paused' | 'ended',
) {
  const { error } = await db()
    .from('invoice_recurring_series')
    .update({ status })
    .eq('account_id', accountId)
    .eq('id', seriesId);
  if (error) throw new Error(error.message);
}

function addFrequency(date: Date, frequency: string) {
  const next = new Date(date);
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'fortnightly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export async function processDueRecurringSeries() {
  const admin = adminDb();
  const now = new Date().toISOString();
  const { data: seriesList, error } = await admin
    .from('invoice_recurring_series')
    .select('*')
    .eq('status', 'active')
    .lte('next_issue_at', now);
  if (error) throw new Error(error.message);

  const service = createInvoicesService(admin);
  let created = 0;

  for (const series of seriesList ?? []) {
    const template = (series.template ?? {}) as Record<string, any>;
    const invoice = await service.createInvoice({
      accountId: series.account_id,
      client_id: series.client_id,
      currency: normalizeInvoiceCurrency(series.currency),
      due_at: template.due_at ?? null,
      notes: template.notes ?? null,
      title: template.title ?? series.title,
      reference_number: template.reference_number ?? null,
    });

    await admin
      .from('invoices')
      .update({
        recurring_series_id: series.id,
        discount_type: template.discount_type ?? null,
        discount_value: template.discount_value ?? 0,
        tax_rate_bp: template.tax_rate_bp ?? 0,
        deposit_type: template.deposit_type ?? null,
        deposit_value: template.deposit_value ?? 0,
        late_fee_type: template.late_fee_type ?? null,
        late_fee_value: template.late_fee_value ?? 0,
        footer_message:
          template.footer_message ?? DEFAULT_INVOICE_FOOTER_MESSAGE,
        email_subject: template.email_subject ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
        email_body: template.email_body ?? DEFAULT_INVOICE_EMAIL_BODY,
        email_signature:
          template.email_signature ?? DEFAULT_INVOICE_EMAIL_SIGNATURE,
      })
      .eq('id', invoice.id);

    if (Array.isArray(template.items) && template.items.length) {
      await service.upsertInvoiceItems({
        accountId: series.account_id,
        invoiceId: invoice.id,
        items: template.items,
      });
    }

    if (series.auto_send && template.sent_to_email) {
      await service.sendInvoice({
        accountId: series.account_id,
        invoiceId: invoice.id,
        sent_to_email: template.sent_to_email,
        email_subject: template.email_subject,
        email_body: template.email_body,
        email_signature: template.email_signature,
      });
    }

    const nextIssue = addFrequency(
      new Date(series.next_issue_at),
      series.frequency,
    );
    const occurrences = (series.occurrences_issued ?? 0) + 1;
    const ended =
      (series.max_occurrences != null &&
        occurrences >= series.max_occurrences) ||
      (series.end_at && nextIssue.toISOString() > series.end_at);

    await admin
      .from('invoice_recurring_series')
      .update({
        next_issue_at: nextIssue.toISOString(),
        occurrences_issued: occurrences,
        status: ended ? 'ended' : series.status,
      })
      .eq('id', series.id);

    created += 1;
  }

  return { created };
}

export function getCheckoutAmountPence(
  invoice: {
    total_pence: number;
    amount_paid_pence?: number | null;
    deposit_type?: string | null;
    deposit_value?: number | null;
  },
  payDepositOnly: boolean,
) {
  const totals = computeInvoiceTotals({
    subtotal_pence: invoice.total_pence,
    deposit_type: invoice.deposit_type as any,
    deposit_value: invoice.deposit_value,
  });
  const remaining = Math.max(
    0,
    (invoice.total_pence ?? 0) - (invoice.amount_paid_pence ?? 0),
  );
  if (payDepositOnly && totals.deposit_due_pence > 0) {
    return Math.min(totals.deposit_due_pence, remaining);
  }
  return remaining;
}
