import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { resolveClientRecipientEmail } from '~/lib/clients/resolve-client-recipient';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';
import { normalizeWorkspaceCurrency } from '~/lib/currency/workspace-currency';
import { Database } from '~/lib/database.types';

import {
  DEFAULT_CONTRACT_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
} from '../contract-smart-fields';
import type {
  CreateContractInput,
  DeleteContractInput,
  GenerateInvoicesFromPaymentPlanInput,
  GetContractForPortalInput,
  GetContractInput,
  GetContractPortalLinkInput,
  ListContractsInput,
  PaymentPlanItem,
  SendContractInput,
  SetContractStatusInput,
  SignAuthorInput,
  SignRecipientInput,
  UpdateContractInput,
} from '../schema/contracts.schema';
import {
  sendContractIssuedEmail,
  sendContractSignedNotifications,
} from './contract-notifications';

export function createContractsService(client: SupabaseClient<Database>) {
  return new ContractsService(client);
}

class ContractsService {
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

  private parsePaymentPlan(raw: unknown): PaymentPlanItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is PaymentPlanItem =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as PaymentPlanItem).label === 'string' &&
        typeof (item as PaymentPlanItem).percent === 'number',
    );
  }

  private isFullySigned(contract: {
    author_signed_at?: string | null;
    recipient_signed_at?: string | null;
  }) {
    return Boolean(contract.author_signed_at && contract.recipient_signed_at);
  }

  async logEvent(params: {
    accountId: string;
    contractId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    actorId?: string | null;
  }) {
    const { error } = await this.db.from('contract_events').insert({
      account_id: params.accountId,
      contract_id: params.contractId,
      event_type: params.eventType,
      payload: params.payload ?? {},
      actor_id: params.actorId ?? null,
    });
    if (error) this.throwErr(error);
  }

  async listContracts(params: ListContractsInput) {
    await this.ensureUser();

    const {
      accountId,
      page = 1,
      pageSize = 20,
      query,
      status,
      clientId,
      dealId,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from('contracts')
      .select('*, clients(display_name)', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status === 'unsigned') {
      q = q
        .in('status', ['draft', 'ready_to_sign', 'sent'])
        .or('author_signed_at.is.null,recipient_signed_at.is.null');
    } else if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    if (clientId) {
      q = q.eq('client_id', clientId);
    }
    if (dealId) {
      q = q.eq('deal_id', dealId);
    }
    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`title.ilike.${term},clients.display_name.ilike.${term}`);
    }

    const { data, error, count } = await q;
    if (error) this.throwErr(error);

    return { data: data ?? [], total: count ?? 0 };
  }

  async getContract(params: GetContractInput) {
    await this.ensureUser();

    const { data: contract, error: contractError } = await this.db
      .from('contracts')
      .select('*')
      .eq('id', params.contractId)
      .eq('account_id', params.accountId)
      .single();
    if (contractError) this.throwErr(contractError);
    if (!contract) return null;

    const clientPromise = contract.client_id
      ? this.db
          .from('clients')
          .select(
            'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', contract.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const dealPromise = contract.deal_id
      ? this.db
          .from('pipeline_deals')
          .select('id, title, client_id')
          .eq('id', contract.deal_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [{ data: client }, { data: deal }] = await Promise.all([
      clientPromise,
      dealPromise,
    ]);

    let preferred_send_email: string | null =
      contract.recipient_email ?? contract.sent_to_email ?? null;
    let preferred_send_source: string | null = preferred_send_email
      ? 'document'
      : null;

    if (contract.client_id) {
      const recipient = await resolveClientRecipientEmail(
        this.db,
        contract.client_id,
        {
          purpose: 'contract',
          fallbackEmail: contract.sent_to_email ?? contract.recipient_email,
        },
      );
      preferred_send_email = recipient.email;
      preferred_send_source = recipient.source;
    }

    return {
      ...contract,
      payment_plan: this.parsePaymentPlan(contract.payment_plan),
      client,
      deal,
      preferred_send_email,
      preferred_send_source,
    };
  }

  async createContract(input: CreateContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const currency = input.currency
      ? normalizeWorkspaceCurrency(input.currency)
      : await getWorkspaceCurrencyWithClient(this.db, input.accountId);

    const { data: contract, error } = await this.db
      .from('contracts')
      .insert({
        account_id: input.accountId,
        client_id: input.client_id ?? null,
        deal_id: input.deal_id ?? null,
        proposal_id: input.proposal_id ?? null,
        title: input.title ?? 'Agreement',
        content_html: input.content_html ?? '',
        status: 'draft',
        total_pence: input.total_pence ?? 0,
        currency,
        payment_plan: input.payment_plan ?? [],
        auto_send_on_approval: input.auto_send_on_approval ?? false,
        recipient_email: input.recipient_email ?? null,
        recipient_name: input.recipient_name ?? null,
        recipient_company: input.recipient_company ?? null,
        recipient_type: input.recipient_type ?? null,
        email_subject: DEFAULT_CONTRACT_EMAIL_SUBJECT,
        email_body: DEFAULT_CONTRACT_EMAIL_BODY,
        email_signature: DEFAULT_CONTRACT_EMAIL_SIGNATURE,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: contract.id,
      eventType: 'created',
      payload: {
        client_id: input.client_id ?? null,
        deal_id: input.deal_id ?? null,
      },
      actorId: user.id,
    });

    return contract;
  }

  async updateContract(input: UpdateContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: existing, error: existingError } = await this.db
      .from('contracts')
      .select('status')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (existingError) this.throwErr(existingError);
    if (existing?.status !== 'draft') {
      throw new Error('Only draft contracts can be edited');
    }

    const payload: Record<string, unknown> = {};
    if (input.client_id !== undefined) payload.client_id = input.client_id;
    if (input.deal_id !== undefined) payload.deal_id = input.deal_id;
    if (input.title !== undefined) payload.title = input.title;
    if (input.content_html !== undefined)
      payload.content_html = input.content_html;
    if (input.total_pence !== undefined)
      payload.total_pence = input.total_pence;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.payment_plan !== undefined)
      payload.payment_plan = input.payment_plan;
    if (input.auto_send_on_approval !== undefined) {
      payload.auto_send_on_approval = input.auto_send_on_approval;
    }
    if (input.author_type !== undefined)
      payload.author_type = input.author_type;
    if (input.author_name !== undefined)
      payload.author_name = input.author_name;
    if (input.author_company !== undefined)
      payload.author_company = input.author_company;
    if (input.recipient_type !== undefined)
      payload.recipient_type = input.recipient_type;
    if (input.recipient_name !== undefined)
      payload.recipient_name = input.recipient_name;
    if (input.recipient_company !== undefined)
      payload.recipient_company = input.recipient_company;
    if (input.recipient_email !== undefined)
      payload.recipient_email = input.recipient_email;
    if (input.email_subject !== undefined)
      payload.email_subject = input.email_subject;
    if (input.email_body !== undefined) payload.email_body = input.email_body;
    if (input.email_signature !== undefined)
      payload.email_signature = input.email_signature;
    if (input.private_note !== undefined)
      payload.private_note = input.private_note;

    const { data, error } = await this.db
      .from('contracts')
      .update(payload)
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'updated',
      payload: { fields: Object.keys(payload) },
      actorId: user.id,
    });

    return data;
  }

  async deleteContract(params: DeleteContractInput) {
    await this.ensureUserAndPermission(params.accountId, 'invoices.edit');
    await this.ensureOwnerOrAdmin(params.accountId);

    const { data: existing, error: existingError } = await this.db
      .from('contracts')
      .select('status')
      .eq('id', params.contractId)
      .eq('account_id', params.accountId)
      .single();
    if (existingError) this.throwErr(existingError);
    if (existing?.status !== 'draft') {
      throw new Error('Only draft contracts can be deleted');
    }

    const { error } = await this.db
      .from('contracts')
      .delete()
      .eq('id', params.contractId)
      .eq('account_id', params.accountId);
    if (error) this.throwErr(error);
  }

  async setContractStatus(input: SetContractStatusInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: existing, error: fetchError } = await this.db
      .from('contracts')
      .select('status')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError) this.throwErr(fetchError);

    if (input.status === 'cancelled') {
      if (
        !['draft', 'ready_to_sign', 'sent'].includes(existing?.status ?? '')
      ) {
        throw new Error('Only unsigned contracts can be cancelled');
      }
    }

    const { data, error } = await this.db
      .from('contracts')
      .update({ status: input.status })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'status_changed',
      payload: { old_status: existing?.status, new_status: input.status },
      actorId: user.id,
    });

    return data;
  }

  async sendContract(input: SendContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error: fetchError } = await this.db
      .from('contracts')
      .select('id, status, public_token, author_signed_at')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError || !contract)
      this.throwErr(fetchError, 'Contract not found');

    const emailPatch: Record<string, unknown> = {};
    if (input.email_subject) emailPatch.email_subject = input.email_subject;
    if (input.email_body) emailPatch.email_body = input.email_body;
    if (input.email_signature)
      emailPatch.email_signature = input.email_signature;

    if (Object.keys(emailPatch).length > 0) {
      await this.db
        .from('contracts')
        .update(emailPatch)
        .eq('id', input.contractId)
        .eq('account_id', input.accountId);
    }

    const senderInfo = {
      first_name:
        typeof user.user_metadata?.first_name === 'string'
          ? user.user_metadata.first_name
          : null,
      last_name:
        typeof user.user_metadata?.last_name === 'string'
          ? user.user_metadata.last_name
          : null,
      email: user.email ?? null,
    };

    if (input.send_test_to_self) {
      const testEmail = user.email;
      if (!testEmail) throw new Error('No email on your account for test send');

      let testToken = contract.public_token;
      if (!testToken) {
        const { randomBytes } = await import('crypto');
        testToken = randomBytes(32).toString('hex');
        await this.db
          .from('contracts')
          .update({ public_token: testToken })
          .eq('id', input.contractId)
          .eq('account_id', input.accountId);
      }

      await sendContractIssuedEmail({
        accountId: input.accountId,
        contractId: input.contractId,
        recipientEmail: testEmail,
        testOnly: true,
        sender: senderInfo,
      });
      return { test_sent: true };
    }

    if (!contract.author_signed_at) {
      throw new Error('The author must sign the contract before sending');
    }

    if (!['ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error(
        'Only contracts ready to sign or already sent can be emailed',
      );
    }

    let public_token = contract.public_token;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.db
      .from('contracts')
      .update({
        public_token,
        status: 'sent',
        sent_at: now,
        sent_to_email: input.sent_to_email,
        recipient_email: input.sent_to_email,
      })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'sent',
      payload: { sent_to_email: input.sent_to_email },
      actorId: user.id,
    });

    try {
      await sendContractIssuedEmail({
        accountId: input.accountId,
        contractId: input.contractId,
        recipientEmail: input.sent_to_email,
        sender: senderInfo,
      });
    } catch {
      // Keep the contract in sent state even if email delivery fails.
    }

    return updated;
  }

  async signAuthor(input: SignAuthorInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error: fetchError } = await this.db
      .from('contracts')
      .select('*')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError || !contract)
      this.throwErr(fetchError, 'Contract not found');

    if (!['draft', 'ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error('This contract can no longer be signed by the author');
    }

    const now = new Date().toISOString();
    const sendAfterSign = input.send_after_sign ?? false;
    const recipientEmail =
      input.sent_to_email ??
      contract.recipient_email ??
      contract.sent_to_email ??
      null;

    let public_token = contract.public_token as string | null;
    let status: 'ready_to_sign' | 'sent' = 'ready_to_sign';
    const patch: Record<string, unknown> = {
      author_type: input.author_type,
      author_name: input.author_name,
      author_company: input.author_company ?? null,
      author_signature_type: input.author_signature_type,
      author_signature_data: input.author_signature_data,
      author_signed_at: now,
    };

    if (sendAfterSign) {
      if (!recipientEmail) {
        throw new Error('Recipient email is required to send after signing');
      }
      if (!public_token) {
        const { randomBytes } = await import('crypto');
        public_token = randomBytes(32).toString('hex');
      }
      status = 'sent';
      patch.public_token = public_token;
      patch.status = 'sent';
      patch.sent_at = now;
      patch.sent_to_email = recipientEmail;
      patch.recipient_email = recipientEmail;
    } else {
      patch.status = 'ready_to_sign';
    }

    const { data: updated, error } = await this.db
      .from('contracts')
      .update(patch)
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'author_signed',
      payload: {
        author_signature_type: input.author_signature_type,
        send_after_sign: sendAfterSign,
        status,
      },
      actorId: user.id,
    });

    if (sendAfterSign && recipientEmail) {
      try {
        await sendContractIssuedEmail({
          accountId: input.accountId,
          contractId: input.contractId,
          recipientEmail,
          sender: {
            first_name:
              typeof user.user_metadata?.first_name === 'string'
                ? user.user_metadata.first_name
                : null,
            last_name:
              typeof user.user_metadata?.last_name === 'string'
                ? user.user_metadata.last_name
                : null,
            email: user.email ?? null,
          },
        });
      } catch {
        // Non-blocking email failure.
      }
    }

    const { finalizeContractIfFullySigned } =
      await import('./contract-v2.server');
    const finalized = await finalizeContractIfFullySigned(
      input.contractId,
      input.accountId,
    );

    return finalized ?? updated;
  }

  /** Portal recipient signature (no auth). */
  async signRecipient(input: SignRecipientInput) {
    const { data: contract, error: fetchError } = await this.db
      .from('contracts')
      .select('*')
      .eq('public_token', input.token)
      .single();
    if (fetchError || !contract)
      this.throwErr(fetchError, 'Contract not found');

    if (!['sent', 'ready_to_sign'].includes(contract.status)) {
      throw new Error('This contract is not available for signing');
    }

    if (!contract.author_signed_at) {
      throw new Error('The author must sign before the recipient');
    }

    if (contract.recipient_signed_at) {
      throw new Error('This contract has already been signed by the recipient');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.db
      .from('contracts')
      .update({
        recipient_type: input.recipient_type,
        recipient_name: input.recipient_name,
        recipient_company: input.recipient_company ?? null,
        recipient_signature_type: input.recipient_signature_type,
        recipient_signature_data: input.recipient_signature_data,
        recipient_signed_at: now,
      })
      .eq('id', contract.id)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: contract.account_id,
      contractId: contract.id,
      eventType: 'recipient_signed',
      payload: {
        recipient_signature_type: input.recipient_signature_type,
      },
      actorId: null,
    });

    const { finalizeContractIfFullySigned } =
      await import('./contract-v2.server');
    const finalized = await finalizeContractIfFullySigned(
      contract.id,
      contract.account_id,
    );

    if (finalized?.status === 'signed') {
      try {
        await sendContractSignedNotifications({
          accountId: contract.account_id,
          contractId: contract.id,
        });
      } catch {
        // Non-blocking email failure.
      }
    }

    return finalized ?? updated;
  }

  async generateInvoicesFromPaymentPlan(
    input: GenerateInvoicesFromPaymentPlanInput,
  ) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: contract, error } = await this.db
      .from('contracts')
      .select(
        'id, status, author_signed_at, recipient_signed_at, invoices_generated_at',
      )
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (contract.status !== 'signed' || !this.isFullySigned(contract)) {
      throw new Error(
        'Invoices can only be generated after both parties have signed',
      );
    }

    if (contract.invoices_generated_at) {
      return { already_generated: true, invoices: [] };
    }

    const { generateInstalmentInvoices } = await import('./contract-v2.server');
    const invoices = await generateInstalmentInvoices(
      input.contractId,
      input.accountId,
    );
    return { already_generated: false, invoices };
  }

  async getContractForPortal(params: GetContractForPortalInput) {
    const { data: contract, error: contractError } = await this.db
      .from('contracts')
      .select('*')
      .eq('public_token', params.token)
      .single();
    if (contractError || !contract) return null;

    if (contract.status === 'cancelled' || contract.status === 'draft') {
      return null;
    }

    const clientPromise = contract.client_id
      ? this.db
          .from('clients')
          .select(
            'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', contract.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const { data: account } = await this.db
      .from('accounts')
      .select('id, name, slug')
      .eq('id', contract.account_id)
      .maybeSingle();

    const { data: client } = await clientPromise;

    return {
      ...contract,
      payment_plan: this.parsePaymentPlan(contract.payment_plan),
      client,
      account,
    };
  }

  async getContractPortalLink(
    input: GetContractPortalLinkInput,
  ): Promise<{ token: string }> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: contract, error } = await this.db
      .from('contracts')
      .select('id, status, public_token, author_signed_at')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (!contract.author_signed_at) {
      throw new Error('The author must sign before sharing a portal link');
    }

    if (!['ready_to_sign', 'sent', 'signed'].includes(contract.status)) {
      throw new Error(
        'Portal link is only available for contracts out for signature',
      );
    }

    let public_token = contract.public_token as string | null;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');

      const { error: updateError } = await this.db
        .from('contracts')
        .update({ public_token })
        .eq('id', input.contractId)
        .eq('account_id', input.accountId);
      if (updateError) this.throwErr(updateError);
    }

    return { token: public_token };
  }
}
