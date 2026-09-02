import { isInvoiceOverdue } from '~/home/[account]/invoices/_lib/invoice-totals';
import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';
import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';

import { NativeHttpError } from './http';

/** Same business profiles as Clients — invoices stay off personal / family / community. */
export const NATIVE_INVOICE_WORKSPACE_PROFILES = [
  'work_design',
  'commercial_property',
  'building_surveyor',
] as const;

export type NativeInvoiceWorkspaceProfile =
  (typeof NATIVE_INVOICE_WORKSPACE_PROFILES)[number];

export const OPEN_NATIVE_INVOICE_DB_STATUSES = [
  'sent',
  'read',
  'overdue',
] as const;

export const PAID_NATIVE_INVOICE_DB_STATUSES = ['paid'] as const;

export type NativeInvoiceListStatus = 'open' | 'paid' | 'overdue' | 'all';

export type NativeInvoiceClientRow = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  client_type?: string | null;
};

export type NativeInvoiceRow = {
  id: string;
  invoice_number?: string | null;
  status?: string | null;
  due_at?: string | null;
  issued_at?: string | null;
  paid_at?: string | null;
  total_pence?: number | null;
  amount_paid_pence?: number | null;
  currency?: string | null;
  public_token?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
  client_id?: string | null;
  clients?: NativeInvoiceClientRow | NativeInvoiceClientRow[] | null;
};

export type NativeInvoiceLine = {
  description: string;
  amount: string;
  amount_pence: number;
};

export type NativeInvoice = {
  id: string;
  number: string;
  client_name: string;
  status: string;
  due: string | null;
  total: string;
  total_pence: number;
  balance: string;
  balance_pence: number;
  currency: string;
};

export type NativeInvoiceDetail = NativeInvoice & {
  issued: string | null;
  paid: string | null;
  lines: NativeInvoiceLine[];
  url: string | null;
  web_path: string | null;
};

export type NativeFinances = {
  outstanding_balance: string;
  outstanding_balance_pence: number;
  overdue_count: number;
  overdue_amount: string;
  overdue_amount_pence: number;
  paid_this_month: string | null;
  paid_this_month_pence: number | null;
  currency: string;
  recent: NativeInvoice[];
};

export function workspaceShowsNativeInvoices(
  profile: string | null | undefined,
) {
  return (NATIVE_INVOICE_WORKSPACE_PROFILES as readonly string[]).includes(
    profile ?? '',
  );
}

export function parseNativeInvoiceListStatus(
  value: string | null | undefined,
): NativeInvoiceListStatus {
  if (value == null || value.trim() === '') {
    return 'open';
  }

  switch (value.trim().toLowerCase()) {
    case 'open':
      return 'open';
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'overdue';
    case 'all':
      return 'all';
    default:
      throw new NativeHttpError(
        400,
        'status must be open, paid, overdue, or all',
      );
  }
}

export function invoiceBalancePence(
  totalPence: number | null | undefined,
  amountPaidPence: number | null | undefined,
) {
  return Math.max(0, (totalPence ?? 0) - (amountPaidPence ?? 0));
}

export function isNativeInvoiceOverdue(
  row: Pick<NativeInvoiceRow, 'status' | 'due_at'>,
  _now: Date = new Date(),
) {
  const status = row.status?.trim() || '';
  if (status === 'overdue') {
    return true;
  }
  if (!['sent', 'read'].includes(status) || !row.due_at) {
    return false;
  }

  return isInvoiceOverdue({
    status,
    due_at: row.due_at,
  });
}

export function displayNativeInvoiceStatus(
  row: Pick<
    NativeInvoiceRow,
    'status' | 'due_at' | 'amount_paid_pence' | 'total_pence'
  >,
  now: Date = new Date(),
) {
  const status = row.status?.trim() || 'draft';
  if (
    isNativeInvoiceOverdue(row, now) &&
    (status === 'sent' || status === 'read')
  ) {
    return 'overdue';
  }
  if (status === 'sent' || status === 'read') {
    const paid = row.amount_paid_pence ?? 0;
    const total = row.total_pence ?? 0;
    if (paid > 0 && paid < total) {
      return 'partial';
    }
  }
  return status;
}

export function nativeInvoiceClientName(
  clients: NativeInvoiceRow['clients'],
): string {
  const row = Array.isArray(clients) ? (clients[0] ?? null) : (clients ?? null);
  if (!row) {
    return 'Client';
  }

  return resolveClientListTitle(row).trim() || 'Client';
}

export function nativeInvoiceDueDate(dueAt: string | null | undefined) {
  if (!dueAt) {
    return null;
  }
  const trimmed = dueAt.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 10);
}

export function nativeInvoicePublicUrl(
  publicToken: string | null | undefined,
  origin: string | null | undefined,
) {
  const token = publicToken?.trim();
  const base = origin?.replace(/\/+$/, '');
  if (!token || !base) {
    return null;
  }
  return `${base}/portal/invoices/${token}`;
}

export function nativeInvoiceWebPath(workspaceSlug: string, invoiceId: string) {
  const slug = workspaceSlug.trim();
  const id = invoiceId.trim();
  if (!slug || !id) {
    return null;
  }
  return `/home/${slug}/invoices/${id}`;
}

export function mapNativeInvoice(
  row: NativeInvoiceRow,
  options?: { now?: Date },
): NativeInvoice {
  const currency = row.currency?.trim() || 'gbp';
  const totalPence = row.total_pence ?? 0;
  const balancePence = invoiceBalancePence(totalPence, row.amount_paid_pence);

  return {
    id: row.id,
    number: row.invoice_number?.trim() || 'Invoice',
    client_name: nativeInvoiceClientName(row.clients),
    status: displayNativeInvoiceStatus(row, options?.now),
    due: nativeInvoiceDueDate(row.due_at),
    total: formatWorkspaceMoney(totalPence, currency),
    total_pence: totalPence,
    balance: formatWorkspaceMoney(balancePence, currency),
    balance_pence: balancePence,
    currency,
  };
}

export function mapNativeInvoiceLine(input: {
  description?: string | null;
  total_pence?: number | null;
  currency: string;
}): NativeInvoiceLine {
  const amountPence = input.total_pence ?? 0;
  return {
    description: input.description?.trim() || 'Line',
    amount: formatWorkspaceMoney(amountPence, input.currency),
    amount_pence: amountPence,
  };
}

export function summariseNativeFinances(
  invoices: NativeInvoiceRow[],
  options?: { now?: Date; recentLimit?: number },
): NativeFinances {
  const now = options?.now ?? new Date();
  const recentLimit = options?.recentLimit ?? 5;
  const currency = invoices[0]?.currency?.trim() || 'gbp';

  let outstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidThisMonth = 0;
  let hasPaidThisMonth = false;

  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  for (const row of invoices) {
    const status = row.status?.trim() || '';
    const balance = invoiceBalancePence(row.total_pence, row.amount_paid_pence);

    if (
      (OPEN_NATIVE_INVOICE_DB_STATUSES as readonly string[]).includes(status)
    ) {
      outstanding += balance;
      if (isNativeInvoiceOverdue(row, now)) {
        overdueCount += 1;
        overdueAmount += balance;
      }
    }

    if (status === 'paid' && row.paid_at && row.paid_at >= monthStart) {
      paidThisMonth += row.total_pence ?? 0;
      hasPaidThisMonth = true;
    }
  }

  const recent = [...invoices]
    .sort((left, right) => {
      const leftAt = left.created_at ?? left.issued_at ?? '';
      const rightAt = right.created_at ?? right.issued_at ?? '';
      return rightAt.localeCompare(leftAt);
    })
    .slice(0, recentLimit)
    .map((row) => mapNativeInvoice(row, { now }));

  return {
    outstanding_balance: formatWorkspaceMoney(outstanding, currency),
    outstanding_balance_pence: outstanding,
    overdue_count: overdueCount,
    overdue_amount: formatWorkspaceMoney(overdueAmount, currency),
    overdue_amount_pence: overdueAmount,
    paid_this_month: hasPaidThisMonth
      ? formatWorkspaceMoney(paidThisMonth, currency)
      : null,
    paid_this_month_pence: hasPaidThisMonth ? paidThisMonth : null,
    currency,
    recent,
  };
}

export function rowMatchesNativeInvoiceStatus(
  row: NativeInvoiceRow,
  status: NativeInvoiceListStatus,
  now: Date = new Date(),
) {
  const dbStatus = row.status?.trim() || '';

  switch (status) {
    case 'all':
      return true;
    case 'paid':
      return dbStatus === 'paid';
    case 'open':
      return (OPEN_NATIVE_INVOICE_DB_STATUSES as readonly string[]).includes(
        dbStatus,
      );
    case 'overdue':
      return isNativeInvoiceOverdue(row, now);
    default:
      return false;
  }
}
