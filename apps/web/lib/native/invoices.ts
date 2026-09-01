import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildAppSiteUrl } from '~/lib/app-host-routing';

import { NativeHttpError } from './http';
import {
  type NativeFinances,
  type NativeInvoice,
  type NativeInvoiceDetail,
  type NativeInvoiceListStatus,
  type NativeInvoiceRow,
  OPEN_NATIVE_INVOICE_DB_STATUSES,
  PAID_NATIVE_INVOICE_DB_STATUSES,
  mapNativeInvoice,
  mapNativeInvoiceLine,
  nativeInvoicePublicUrl,
  nativeInvoiceWebPath,
  parseNativeInvoiceListStatus,
  rowMatchesNativeInvoiceStatus,
  summariseNativeFinances,
  workspaceShowsNativeInvoices,
} from './invoices-shared';
import type { NativeWorkspace } from './workspace-shared';

export type {
  NativeFinances,
  NativeInvoice,
  NativeInvoiceDetail,
  NativeInvoiceLine,
  NativeInvoiceListStatus,
} from './invoices-shared';
export {
  NATIVE_INVOICE_WORKSPACE_PROFILES,
  OPEN_NATIVE_INVOICE_DB_STATUSES,
  PAID_NATIVE_INVOICE_DB_STATUSES,
  mapNativeInvoice,
  parseNativeInvoiceListStatus,
  workspaceShowsNativeInvoices,
} from './invoices-shared';

const INVOICE_LIST_LIMIT = 200;

const INVOICE_SELECT =
  'id, invoice_number, status, due_at, issued_at, paid_at, total_pence, amount_paid_pence, currency, public_token, created_at, archived_at, client_id, clients(display_name, first_name, last_name, company_name, client_type)';

const ITEM_SELECT = 'description, total_pence, sort_order';

function emptyFinances(): NativeFinances {
  return summariseNativeFinances([]);
}

/**
 * Invoices for the selected workspace. Personal / family / community return
 * `[]` (not 403) so a stale phone tab never errors the user into an empty list.
 */
export async function listNativeInvoices(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  options?: { status?: string | null },
): Promise<NativeInvoice[]> {
  if (!workspaceShowsNativeInvoices(workspace.profile)) {
    return [];
  }

  const listStatus = parseNativeInvoiceListStatus(options?.status);
  const rows = await loadNativeInvoiceRows(client, workspace.id, listStatus);
  return rows.map((row) => mapNativeInvoice(row));
}

export async function getNativeInvoice(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  invoiceId: string,
): Promise<NativeInvoiceDetail> {
  if (!workspaceShowsNativeInvoices(workspace.profile)) {
    throw new NativeHttpError(404, 'Invoice not found');
  }

  const id = invoiceId.trim();
  if (!id) {
    throw new NativeHttpError(404, 'Invoice not found');
  }

  const row = await loadNativeInvoiceRow(client, workspace.id, id);
  if (!row) {
    throw new NativeHttpError(404, 'Invoice not found');
  }

  const lines = await loadNativeInvoiceLines(client, workspace.id, id);
  const mapped = mapNativeInvoice(row);
  const origin = buildAppSiteUrl('/').replace(/\/+$/, '');

  return {
    ...mapped,
    issued: row.issued_at ?? null,
    paid: row.paid_at ?? null,
    lines: lines.map((line) =>
      mapNativeInvoiceLine({
        description: line.description,
        total_pence: line.total_pence,
        currency: mapped.currency,
      }),
    ),
    url: nativeInvoicePublicUrl(row.public_token, origin),
    web_path: nativeInvoiceWebPath(workspace.slug || workspace.id, mapped.id),
  };
}

export async function getNativeFinances(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeFinances> {
  if (!workspaceShowsNativeInvoices(workspace.profile)) {
    return emptyFinances();
  }

  const rows = await loadNativeInvoiceRows(client, workspace.id, 'all');
  return summariseNativeFinances(rows);
}

async function loadNativeInvoiceRows(
  client: SupabaseClient,
  accountId: string,
  status: NativeInvoiceListStatus,
): Promise<NativeInvoiceRow[]> {
  let query = client
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('account_id', accountId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(INVOICE_LIST_LIMIT);

  if (status === 'open') {
    query = query.in('status', [...OPEN_NATIVE_INVOICE_DB_STATUSES]);
  } else if (status === 'paid') {
    query = query.in('status', [...PAID_NATIVE_INVOICE_DB_STATUSES]);
  } else if (status === 'overdue') {
    query = query.in('status', [...OPEN_NATIVE_INVOICE_DB_STATUSES]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as NativeInvoiceRow[];
  if (status !== 'overdue') {
    return rows;
  }

  const now = new Date();
  return rows.filter((row) =>
    rowMatchesNativeInvoiceStatus(row, 'overdue', now),
  );
}

async function loadNativeInvoiceRow(
  client: SupabaseClient,
  accountId: string,
  invoiceId: string,
): Promise<NativeInvoiceRow | null> {
  const { data, error } = await client
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('account_id', accountId)
    .eq('id', invoiceId)
    .is('archived_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as NativeInvoiceRow | null) ?? null;
}

async function loadNativeInvoiceLines(
  client: SupabaseClient,
  accountId: string,
  invoiceId: string,
): Promise<
  Array<{ description?: string | null; total_pence?: number | null }>
> {
  const { data, error } = await client
    .from('invoice_items')
    .select(ITEM_SELECT)
    .eq('account_id', accountId)
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    description?: string | null;
    total_pence?: number | null;
  }>;
}
