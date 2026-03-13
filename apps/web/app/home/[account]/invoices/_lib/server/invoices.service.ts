import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { Database } from '~/lib/database.types';

import type {
  GetInvoicePortalLinkInput,
  CreateInvoiceInput,
  DeleteInvoiceInput,
  GetInvoiceForPortalInput,
  GetInvoiceInput,
  ListInvoicesInput,
  SendInvoiceInput,
  SetInvoiceStatusInput,
  UpdateInvoiceInput,
  UpsertInvoiceItemsInput,
} from '../schema/invoices.schema';
import {
  sendInvoiceIssuedEmail,
  sendInvoicePaidNotifications,
} from './invoice-notifications';

export function createInvoicesService(client: SupabaseClient<Database>) {
  return new InvoicesService(client);
}

class InvoicesService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureUserAndPermission(
    accountId: string,
    permission: 'invoices.view' | 'invoices.edit',
  ) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  private async ensureOwnerOrAdmin(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) this.throwErr(error);
    const role = data?.account_role;
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only account owners and admins can perform this action');
    }
  }

  /** Allocate next invoice number for account (transaction-safe RPC). */
  async allocateInvoiceNumber(accountId: string): Promise<string> {
    const { data, error } = await this.db.rpc('allocate_invoice_number', {
      p_account_id: accountId,
    });
    if (error) this.throwErr(error, 'Failed to allocate invoice number');
    return data as string;
  }

  /** Recalculate and update invoice subtotal_pence and total_pence from items. */
  async computeTotals(invoiceId: string): Promise<{ subtotal_pence: number; total_pence: number }> {
    const { data: items, error: itemsError } = await this.db
      .from('invoice_items')
      .select('total_pence')
      .eq('invoice_id', invoiceId);
    if (itemsError) this.throwErr(itemsError);
    const total_pence = (items ?? []).reduce((sum: number, row: { total_pence: number }) => sum + row.total_pence, 0);
    const { error: updateError } = await this.db
      .from('invoices')
      .update({ subtotal_pence: total_pence, total_pence })
      .eq('id', invoiceId);
    if (updateError) this.throwErr(updateError);
    return { subtotal_pence: total_pence, total_pence };
  }

  /** Log an audit event for an invoice. */
  async logEvent(params: {
    accountId: string;
    invoiceId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    actorId?: string | null;
  }) {
    const { error } = await this.db.from('invoice_events').insert({
      account_id: params.accountId,
      invoice_id: params.invoiceId,
      event_type: params.eventType,
      payload: params.payload ?? null,
      actor_id: params.actorId ?? null,
    });
    if (error) this.throwErr(error);
  }

  async listInvoices(params: ListInvoicesInput) {
    await this.ensureUser();

    const { accountId, page = 1, pageSize = 20, query, status } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from('invoices')
      .select('*, clients(display_name)', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status === 'overdue') {
      q = q
        .eq('status', 'sent')
        .lt('due_at', new Date().toISOString());
    } else if (status) {
      q = q.eq('status', status);
    }
    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`invoice_number.ilike.${term},clients.display_name.ilike.${term}`);
    }

    const { data, error, count } = await q;
    if (error) this.throwErr(error);
    return { data: data ?? [], total: count ?? 0 };
  }

  async getInvoice(params: GetInvoiceInput) {
    await this.ensureUser();

    const { data: invoice, error: invError } = await this.db
      .from('invoices')
      .select('*')
      .eq('id', params.invoiceId)
      .eq('account_id', params.accountId)
      .single();
    if (invError) this.throwErr(invError);
    if (!invoice) return null;

    const { data: items, error: itemsError } = await this.db
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', params.invoiceId)
      .order('sort_order', { ascending: true });
    if (itemsError) this.throwErr(itemsError);

    const { data: client } = await this.db
      .from('clients')
      .select('id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country')
      .eq('id', invoice.client_id)
      .single();

    return { ...invoice, items: items ?? [], client };
  }

  async createInvoice(input: CreateInvoiceInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const invoice_number = await this.allocateInvoiceNumber(input.accountId);

    const { data: invoice, error } = await this.db
      .from('invoices')
      .insert({
        account_id: input.accountId,
        client_id: input.client_id,
        invoice_number,
        status: 'draft',
        due_at: input.due_at ?? null,
        subtotal_pence: 0,
        total_pence: 0,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: invoice.id,
      eventType: 'created',
      payload: { client_id: input.client_id },
      actorId: user.id,
    });
    return invoice;
  }

  async updateInvoice(input: UpdateInvoiceInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: existingInvoice, error: existingInvoiceError } = await this.db
      .from('invoices')
      .select('status')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (existingInvoiceError) this.throwErr(existingInvoiceError);
    if (existingInvoice?.status !== 'draft') {
      throw new Error('Sent, paid, or cancelled invoices can no longer be edited');
    }

    const payload: Record<string, unknown> = {};
    if (input.client_id !== undefined) payload.client_id = input.client_id;
    if (input.due_at !== undefined) payload.due_at = input.due_at;
    if (input.notes !== undefined) payload.notes = input.notes;

    const { data, error } = await this.db
      .from('invoices')
      .update(payload)
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: input.invoiceId,
      eventType: 'updated',
      payload: Object.keys(payload),
      actorId: user.id,
    });
    return data;
  }

  async deleteInvoice(params: DeleteInvoiceInput) {
    await this.ensureUserAndPermission(params.accountId, 'invoices.edit');
    await this.ensureOwnerOrAdmin(params.accountId);

    const { error } = await this.db
      .from('invoices')
      .delete()
      .eq('id', params.invoiceId)
      .eq('account_id', params.accountId);
    if (error) this.throwErr(error);
  }

  async upsertInvoiceItems(input: UpsertInvoiceItemsInput) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const invoiceId = input.invoiceId;
    const accountId = input.accountId;

    const { data: existingInvoice, error: existingInvoiceError } = await this.db
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .eq('account_id', accountId)
      .single();
    if (existingInvoiceError) this.throwErr(existingInvoiceError);
    if (existingInvoice?.status !== 'draft') {
      throw new Error('Sent, paid, or cancelled invoices can no longer be edited');
    }

    // Delete existing items and re-insert to keep order (simple approach for V1)
    const { error: delError } = await this.db
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('account_id', accountId);
    if (delError) this.throwErr(delError);

    if (input.items.length === 0) {
      await this.computeTotals(invoiceId);
      return [];
    }

    const rows = input.items.map((item, index) => ({
      account_id: accountId,
      invoice_id: invoiceId,
      job_id: item.job_id ?? null,
      sort_order: item.sort_order ?? index,
      description: item.description,
      quantity: item.quantity,
      unit_price_pence: item.unit_price_pence,
      total_pence: item.quantity * item.unit_price_pence,
    }));

    const { data: inserted, error } = await this.db
      .from('invoice_items')
      .insert(rows)
      .select();
    if (error) this.throwErr(error);

    await this.computeTotals(invoiceId);
    return inserted ?? [];
  }

  async setInvoiceStatus(input: SetInvoiceStatusInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.ensureOwnerOrAdmin(input.accountId);

    const { data: existing, error: fetchError } = await this.db
      .from('invoices')
      .select('status, paid_at')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError) this.throwErr(fetchError);
    const oldStatus = existing?.status;
    const paymentMethod = input.payment_method;

    if (input.status === 'sent' || input.status === 'draft') {
      throw new Error('Use the draft flow to send or edit invoices');
    }

    if (input.status === 'cancelled' && oldStatus !== 'sent') {
      throw new Error('Only sent invoices can be cancelled');
    }

    if (input.status === 'paid' && oldStatus !== 'sent') {
      throw new Error('Only sent invoices can be marked as paid');
    }

    if (input.status === 'paid' && !paymentMethod) {
      throw new Error('Choose a payment method when marking an invoice as paid');
    }

    const payload: Record<string, unknown> = { status: input.status };
    if (input.status === 'paid') {
      payload.paid_at = existing?.paid_at ?? new Date().toISOString();
    }
    if (input.status === 'cancelled') {
      payload.paid_at = null;
      payload.stripe_payment_intent_id = null;
      payload.stripe_checkout_session_id = null;
    }

    const { data, error } = await this.db
      .from('invoices')
      .update(payload)
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: input.invoiceId,
      eventType: 'status_changed',
      payload: {
        old_status: oldStatus,
        new_status: input.status,
        payment_method: paymentMethod ?? null,
      },
      actorId: user.id,
    });

    if (input.status === 'paid' && paymentMethod) {
      await this.logEvent({
        accountId: input.accountId,
        invoiceId: input.invoiceId,
        eventType: 'paid',
        payload: {
          payment_method: paymentMethod,
          source: 'manual_status_update',
        },
        actorId: user.id,
      });

      await sendInvoicePaidNotifications({
        accountId: input.accountId,
        invoiceId: input.invoiceId,
        paymentMethod,
      });
    }

    return data;
  }

  /** Send invoice: set public_token (if missing), status sent, issued_at, sent_at, sent_to_email; log event; email client (stub). */
  async sendInvoice(input: SendInvoiceInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: invoice, error: fetchError } = await this.db
      .from('invoices')
      .select('id, status, public_token')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError || !invoice) this.throwErr(fetchError, 'Invoice not found');
    if (invoice.status !== 'draft') throw new Error('Only draft invoices can be sent');

    let public_token = invoice.public_token;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.db
      .from('invoices')
      .update({
        public_token,
        status: 'sent',
        issued_at: now,
        sent_at: now,
        sent_to_email: input.sent_to_email,
      })
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: input.invoiceId,
      eventType: 'sent',
      payload: { sent_to_email: input.sent_to_email },
      actorId: user.id,
    });

    try {
      await sendInvoiceIssuedEmail({
        accountId: input.accountId,
        invoiceId: input.invoiceId,
        recipientEmail: input.sent_to_email,
      });
    } catch {
      // Keep the invoice in sent state even if email delivery fails.
    }

    return updated;
  }

  /** Load invoice by public_token only; no auth. For portal. */
  async getInvoiceForPortal(params: GetInvoiceForPortalInput) {
    const { data: invoice, error: invError } = await this.db
      .from('invoices')
      .select('*')
      .eq('public_token', params.token)
      .single();
    if (invError || !invoice) return null;

    const { data: items } = await this.db
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true });

    const { data: client } = await this.db
      .from('clients')
      .select('id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country')
      .eq('id', invoice.client_id)
      .single();

    return { ...invoice, items: items ?? [], client };
  }

  /** Ensure invoice has a public_token and return it (used for internal payment links). */
  async getInvoicePortalLink(input: GetInvoicePortalLinkInput): Promise<{ token: string }> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: invoice, error } = await this.db
      .from('invoices')
      .select('id, account_id, status, public_token')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !invoice) this.throwErr(error, 'Invoice not found');

    if (invoice.status !== 'sent') {
      throw new Error('You can only create a payment link for a sent invoice');
    }

    let public_token = invoice.public_token as string | null;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');

      const { error: updateError } = await this.db
        .from('invoices')
        .update({ public_token })
        .eq('id', input.invoiceId)
        .eq('account_id', input.accountId);
      if (updateError) this.throwErr(updateError);
    }

    return { token: public_token };
  }
}
