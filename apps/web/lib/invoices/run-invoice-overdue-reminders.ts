import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { notifyInvoiceOverdueInApp } from '~/lib/invoices/invoice-in-app-notifications';

type OverdueInvoiceRow = {
  id: string;
  account_id: string;
  invoice_number: string;
  due_at: string;
  total_pence: number | null;
  amount_paid_pence: number | null;
  currency: string | null;
  clients:
    | {
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }
    | {
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function clientNameFromRow(client: OverdueInvoiceRow['clients']): string {
  const row = firstRelation(client);
  if (!row) return 'Client';

  return (
    row.display_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    'Client'
  );
}

/** Daily: in-app notification when an invoice is past due (once per invoice). */
export async function runInvoiceOverdueReminders(admin: SupabaseClient) {
  const now = new Date().toISOString();

  const { data: invoices, error } = await admin
    .from('invoices')
    .select(
      'id, account_id, invoice_number, due_at, total_pence, amount_paid_pence, currency, clients(display_name, first_name, last_name)',
    )
    .in('status', ['sent', 'read'])
    .lt('due_at', now)
    .is('archived_at', null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (invoices ?? []) as OverdueInvoiceRow[];
  const accountIds = Array.from(new Set(rows.map((row) => row.account_id)));
  const slugByAccount = new Map<string, string>();

  if (accountIds.length > 0) {
    const { data: accounts, error: accountsErr } = await admin
      .from('accounts')
      .select('id, slug')
      .in('id', accountIds);

    if (accountsErr) {
      throw new Error(accountsErr.message);
    }

    for (const account of accounts ?? []) {
      if (account.slug) slugByAccount.set(account.id, account.slug);
    }
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const accountSlug = slugByAccount.get(row.account_id);
    if (!accountSlug) {
      skipped++;
      continue;
    }

    const { data: existing } = await admin
      .from('invoice_events')
      .select('id')
      .eq('invoice_id', row.id)
      .eq('event_type', 'overdue_notified')
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const total = row.total_pence ?? 0;
    const paid = row.amount_paid_pence ?? 0;
    const balance = Math.max(0, total - paid);

    try {
      await notifyInvoiceOverdueInApp({
        accountId: row.account_id,
        accountSlug,
        invoiceId: row.id,
        invoiceNumber: row.invoice_number,
        clientName: clientNameFromRow(row.clients),
        dueAt: row.due_at,
        balancePence: balance,
        currency: row.currency ?? 'gbp',
      });

      const { error: logErr } = await admin.from('invoice_events').insert({
        account_id: row.account_id,
        invoice_id: row.id,
        event_type: 'overdue_notified',
        payload: { due_at: row.due_at },
        actor_id: null,
      });

      if (logErr) {
        errors.push(`${row.id}: log insert failed — ${logErr.message}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(
        `${row.id}: ${err instanceof Error ? err.message : 'notify failed'}`,
      );
    }
  }

  return { sent, skipped, errors };
}
