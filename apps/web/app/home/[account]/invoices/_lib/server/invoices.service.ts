import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { resolveClientRecipientEmail } from '~/lib/clients/resolve-client-recipient';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';
import { calculateInvoiceLineTotalPence } from '~/lib/invoices/invoice-quantity';
import { Database } from '~/lib/database.types';

import { normalizeInvoiceCurrency } from '../invoice-currency';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  DEFAULT_INVOICE_FOOTER_MESSAGE,
} from '../invoice-smart-fields';
import { computeInvoiceTotals } from '../invoice-totals';
import type {
  CreateInvoiceInput,
  DeleteInvoiceInput,
  GetInvoiceForPortalInput,
  GetInvoiceInput,
  GetInvoicePortalLinkInput,
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
import { recordInvoicePayment } from './invoice-v2.server';

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
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
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

  private async validateInvoiceProject(
    accountId: string,
    clientId: string,
    projectId: string | null | undefined,
  ) {
    if (!projectId) return;

    const { data: project, error } = await this.db
      .from('projects')
      .select('id, client_id')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!project) throw new Error('Project not found in this workspace');
    if (project.client_id !== clientId) {
      throw new Error('Select a project belonging to the invoice client');
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
  async computeTotals(
    invoiceId: string,
  ): Promise<{ subtotal_pence: number; total_pence: number }> {
    const { data: invoice, error: invoiceError } = await this.db
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();
    if (invoiceError) this.throwErr(invoiceError);

    const { data: items, error: itemsError } = await this.db
      .from('invoice_items')
      .select('total_pence')
      .eq('invoice_id', invoiceId);
    if (itemsError) this.throwErr(itemsError);
    const subtotal_pence = (items ?? []).reduce(
      (sum: number, row: { total_pence: number }) => sum + row.total_pence,
      0,
    );

    const totals = computeInvoiceTotals({
      subtotal_pence,
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

    const { error: updateError } = await this.db
      .from('invoices')
      .update({
        subtotal_pence: totals.subtotal_pence,
        total_pence: totals.total_pence,
      })
      .eq('id', invoiceId);
    if (updateError) this.throwErr(updateError);
    return {
      subtotal_pence: totals.subtotal_pence,
      total_pence: totals.total_pence,
    };
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

    const {
      accountId,
      page = 1,
      pageSize = 20,
      query,
      status,
      clientId,
      dateFrom,
      dateTo,
      includeArchived,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from('invoices')
      .select('*, clients(display_name)', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!includeArchived) {
      q = q.is('archived_at', null);
    }

    if (status === 'unpaid') {
      q = q.in('status', ['sent', 'read']);
    } else if (status === 'overdue') {
      q = q
        .in('status', ['sent', 'read'])
        .lt('due_at', new Date().toISOString());
    } else if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    if (clientId) {
      q = q.eq('client_id', clientId);
    }
    if (dateFrom) {
      q = q.gte('issued_at', dateFrom);
    }
    if (dateTo) {
      q = q.lte('issued_at', dateTo);
    }
    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(
        `invoice_number.ilike.${term},clients.display_name.ilike.${term}`,
      );
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
      .select(
        'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
      )
      .eq('id', invoice.client_id)
      .single();

    const { data: project } = invoice.project_id
      ? await this.db
          .from('projects')
          .select('id, name')
          .eq('id', invoice.project_id)
          .eq('account_id', params.accountId)
          .eq('client_id', invoice.client_id)
          .eq('project_type', 'delivery')
          .maybeSingle()
      : { data: null };

    const recipient = await resolveClientRecipientEmail(
      this.db,
      invoice.client_id,
      {
        purpose: 'invoice',
        fallbackEmail: invoice.sent_to_email,
      },
    );

    return {
      ...invoice,
      items: items ?? [],
      client,
      project: project ? { id: project.id, title: project.name } : null,
      preferred_send_email: recipient.email,
      preferred_send_source: recipient.source,
      preferred_send_name: recipient.contactName,
    };
  }

  async createInvoice(input: CreateInvoiceInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    const invoice_number = await this.allocateInvoiceNumber(input.accountId);

    let currency = normalizeInvoiceCurrency(input.currency);
    if (!input.currency) {
      currency = await getWorkspaceCurrencyWithClient(this.db, input.accountId);
    }

    await this.validateInvoiceProject(
      input.accountId,
      input.client_id,
      input.project_id,
    );

    const { data: invoice, error } = await this.db
      .from('invoices')
      .insert({
        account_id: input.accountId,
        client_id: input.client_id,
        project_id: input.project_id ?? null,
        invoice_number,
        status: 'draft',
        currency,
        due_at: input.due_at ?? null,
        subtotal_pence: 0,
        total_pence: 0,
        notes: input.notes ?? null,
        title: input.title ?? null,
        reference_number: input.reference_number ?? null,
        email_subject: DEFAULT_INVOICE_EMAIL_SUBJECT,
        email_body: DEFAULT_INVOICE_EMAIL_BODY,
        email_signature: DEFAULT_INVOICE_EMAIL_SIGNATURE,
        footer_message: DEFAULT_INVOICE_FOOTER_MESSAGE,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: invoice.id,
      eventType: 'created',
      payload: {
        client_id: input.client_id,
        project_id: input.project_id ?? null,
      },
      actorId: user.id,
    });
    return invoice;
  }

  async updateInvoice(input: UpdateInvoiceInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: existingInvoice, error: existingInvoiceError } = await this.db
      .from('invoices')
      .select('status, client_id, project_id')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (existingInvoiceError) this.throwErr(existingInvoiceError);
    if (existingInvoice?.status !== 'draft') {
      throw new Error('Sent, paid, or void invoices can no longer be edited');
    }

    const nextClientId = input.client_id ?? existingInvoice.client_id;
    const nextProjectId =
      input.project_id !== undefined
        ? input.project_id
        : existingInvoice.project_id;
    await this.validateInvoiceProject(
      input.accountId,
      nextClientId,
      nextProjectId,
    );

    const payload: Record<string, unknown> = {};
    if (input.client_id !== undefined) payload.client_id = input.client_id;
    if (input.project_id !== undefined) payload.project_id = input.project_id;
    if (input.due_at !== undefined) payload.due_at = input.due_at;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.title !== undefined) payload.title = input.title;
    if (input.reference_number !== undefined)
      payload.reference_number = input.reference_number;
    if (input.currency !== undefined) {
      payload.currency = normalizeInvoiceCurrency(input.currency);
    }
    if (input.footer_message !== undefined)
      payload.footer_message = input.footer_message;
    if (input.private_note !== undefined)
      payload.private_note = input.private_note;
    if (input.discount_type !== undefined)
      payload.discount_type = input.discount_type;
    if (input.discount_value !== undefined)
      payload.discount_value = input.discount_value;
    if (input.tax_rate_bp !== undefined)
      payload.tax_rate_bp = input.tax_rate_bp;
    if (input.deposit_type !== undefined)
      payload.deposit_type = input.deposit_type;
    if (input.deposit_value !== undefined)
      payload.deposit_value = input.deposit_value;
    if (input.late_fee_type !== undefined)
      payload.late_fee_type = input.late_fee_type;
    if (input.late_fee_value !== undefined)
      payload.late_fee_value = input.late_fee_value;
    if (input.email_subject !== undefined)
      payload.email_subject = input.email_subject;
    if (input.email_body !== undefined) payload.email_body = input.email_body;
    if (input.email_signature !== undefined)
      payload.email_signature = input.email_signature;

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
      payload: { fields: Object.keys(payload) },
      actorId: user.id,
    });

    await this.computeTotals(input.invoiceId);
    const { data: refreshed } = await this.db
      .from('invoices')
      .select('*')
      .eq('id', input.invoiceId)
      .single();
    return refreshed ?? data;
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
      throw new Error(
        'Sent, paid, or cancelled invoices can no longer be edited',
      );
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
      description_detail: item.description_detail ?? null,
      quantity: item.quantity,
      unit_price_pence: item.unit_price_pence,
      total_pence: calculateInvoiceLineTotalPence(
        item.quantity,
        item.unit_price_pence,
      ),
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
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
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

    if (
      input.status === 'paid' &&
      !['sent', 'read'].includes(oldStatus ?? '')
    ) {
      throw new Error('Only sent invoices can be marked as paid');
    }

    if (
      input.status === 'void' &&
      !['sent', 'read'].includes(oldStatus ?? '')
    ) {
      throw new Error('Only sent invoices can be voided');
    }

    if (input.status === 'paid' && !paymentMethod) {
      throw new Error(
        'Choose a payment method when marking an invoice as paid',
      );
    }

    const payload: Record<string, unknown> = { status: input.status };
    if (input.status === 'paid') {
      payload.paid_at = existing?.paid_at ?? new Date().toISOString();
    }
    if (input.status === 'void') {
      payload.paid_at = null;
      payload.stripe_payment_intent_id = null;
      payload.stripe_checkout_session_id = null;
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
      const { data: invoiceRow } = await this.db
        .from('invoices')
        .select('total_pence, amount_paid_pence')
        .eq('id', input.invoiceId)
        .single();
      const remaining =
        (invoiceRow?.total_pence ?? 0) - (invoiceRow?.amount_paid_pence ?? 0);
      if (remaining > 0) {
        await recordInvoicePayment({
          accountId: input.accountId,
          invoiceId: input.invoiceId,
          amount_pence: remaining,
          payment_method: paymentMethod,
          actorId: user.id,
        });
      }

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
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: invoice, error: fetchError } = await this.db
      .from('invoices')
      .select('id, status, public_token')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError || !invoice) this.throwErr(fetchError, 'Invoice not found');

    const emailPatch: Record<string, unknown> = {};
    if (input.email_subject) emailPatch.email_subject = input.email_subject;
    if (input.email_body) emailPatch.email_body = input.email_body;
    if (input.email_signature)
      emailPatch.email_signature = input.email_signature;

    if (Object.keys(emailPatch).length > 0) {
      await this.db
        .from('invoices')
        .update(emailPatch)
        .eq('id', input.invoiceId)
        .eq('account_id', input.accountId);
    }

    const senderInfo = {
      first_name: user.user_metadata?.first_name ?? null,
      last_name: user.user_metadata?.last_name ?? null,
      email: user.email ?? null,
    };

    try {
      const { data: settings } = await this.db
        .from('user_settings')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settings?.first_name || settings?.last_name) {
        senderInfo.first_name =
          (settings.first_name as string | null)?.trim() ||
          senderInfo.first_name;
        senderInfo.last_name =
          (settings.last_name as string | null)?.trim() || senderInfo.last_name;
      }
    } catch {
      // Fall back to auth metadata only.
    }

    if (input.send_test_to_self) {
      const testEmail = user.email;
      if (!testEmail) throw new Error('No email on your account for test send');

      let testToken = invoice.public_token;
      if (!testToken) {
        const { randomBytes } = await import('crypto');
        testToken = randomBytes(32).toString('hex');
        await this.db
          .from('invoices')
          .update({ public_token: testToken })
          .eq('id', input.invoiceId)
          .eq('account_id', input.accountId);
      }

      await sendInvoiceIssuedEmail({
        accountId: input.accountId,
        invoiceId: input.invoiceId,
        recipientEmail: testEmail,
        testOnly: true,
        sender: senderInfo,
      });
      return { test_sent: true };
    }

    if (invoice.status !== 'draft')
      throw new Error('Only draft invoices can be sent');

    const recipientEmails = Array.from(
      new Set(
        [
          ...(input.sent_to_emails ?? []),
          ...(input.sent_to_email ? [input.sent_to_email] : []),
        ]
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (recipientEmails.length === 0) {
      throw new Error('At least one recipient email is required');
    }
    const primaryEmail = recipientEmails[0]!;

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
        sent_to_email: primaryEmail,
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
      payload: {
        sent_to_email: primaryEmail,
        sent_to_emails: recipientEmails,
      },
      actorId: user.id,
    });

    try {
      for (const recipientEmail of recipientEmails) {
        await sendInvoiceIssuedEmail({
          accountId: input.accountId,
          invoiceId: input.invoiceId,
          recipientEmail,
          sender: senderInfo,
        });
      }
    } catch {
      // Keep the invoice in sent state even if email delivery fails.
    }

    return updated;
  }

  /** Mark a draft invoice as sent without sending email (manual delivery). */
  async markInvoiceSentManually(input: {
    accountId: string;
    invoiceId: string;
    sent_to_email?: string | null;
  }) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: invoice, error } = await this.db
      .from('invoices')
      .select('id, status, public_token, client_id')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !invoice) this.throwErr(error, 'Invoice not found');

    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be marked as sent');
    }

    let public_token = invoice.public_token as string | null;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');
    }

    let sent_to_email = input.sent_to_email?.trim() || null;
    if (!sent_to_email && invoice.client_id) {
      const recipient = await resolveClientRecipientEmail(
        this.db,
        invoice.client_id,
        {
          purpose: 'invoice',
        },
      );
      sent_to_email = recipient.email;
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await this.db
      .from('invoices')
      .update({
        public_token,
        status: 'sent',
        issued_at: now,
        sent_at: now,
        sent_to_email,
      })
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (updateError) this.throwErr(updateError);

    await this.logEvent({
      accountId: input.accountId,
      invoiceId: input.invoiceId,
      eventType: 'sent',
      payload: { sent_to_email, source: 'manual' },
      actorId: user.id,
    });

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
      .select(
        'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
      )
      .eq('id', invoice.client_id)
      .single();

    const { data: project } = invoice.project_id
      ? await this.db
          .from('projects')
          .select('id, name')
          .eq('id', invoice.project_id)
          .eq('account_id', invoice.account_id)
          .eq('client_id', invoice.client_id)
          .eq('project_type', 'delivery')
          .maybeSingle()
      : { data: null };

    return {
      ...invoice,
      items: items ?? [],
      client,
      project: project ? { id: project.id, title: project.name } : null,
    };
  }

  /** Ensure invoice has a public_token and return it (used for internal payment links). */
  async getInvoicePortalLink(
    input: GetInvoicePortalLinkInput,
  ): Promise<{ token: string }> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: invoice, error } = await this.db
      .from('invoices')
      .select('id, account_id, status, public_token')
      .eq('id', input.invoiceId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !invoice) this.throwErr(error, 'Invoice not found');

    if (
      invoice.status !== 'draft' &&
      invoice.status !== 'sent' &&
      invoice.status !== 'read' &&
      invoice.status !== 'overdue'
    ) {
      throw new Error('You can only create a payment link for an open invoice');
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
