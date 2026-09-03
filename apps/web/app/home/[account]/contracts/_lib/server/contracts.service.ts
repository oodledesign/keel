import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { resolveClientRecipientEmail } from '~/lib/clients/resolve-client-recipient';
import { isPaymentPlanTotalValid } from '~/lib/contracts/payment-plan';
import { computeContractPublicTokenExpiry } from '~/lib/contracts/public-token';
import {
  canSignerSign,
  computeContractSigningExpiry,
  isContractSigningExpired,
  nextUnsignedSigner,
  signerTurnErrorMessage,
} from '~/lib/contracts/signing-order';
import { checkContractTokenAccess } from '~/lib/contracts/token-access';
import {
  checkFrozenVersionMatch,
  hashVersionSnapshot,
  overlayContractVersion,
  staleVersionErrorMessage,
} from '~/lib/contracts/version-snapshot';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';
import { normalizeWorkspaceCurrency } from '~/lib/currency/workspace-currency';
import { Database } from '~/lib/database.types';

import {
  DEFAULT_CONTRACT_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
  hasSmartFieldTokens,
  renderContractSmartFields,
} from '../contract-smart-fields';
import type {
  ArchiveContractInput,
  CreateContractInput,
  CreateContractTemplateInput,
  CreateContractVersionInput,
  DeclineRecipientInput,
  DeleteContractInput,
  DeleteContractTemplateInput,
  DuplicateContractInput,
  GenerateInvoicesFromPaymentPlanInput,
  GetContractForPortalInput,
  GetContractInput,
  GetContractPortalLinkInput,
  ListContractEventsInput,
  ListContractTemplatesInput,
  ListContractsInput,
  PaymentPlanItem,
  RevokeContractPortalLinkInput,
  SaveContractAsTemplateInput,
  SendContractInput,
  SendContractReminderInput,
  SetContractPortalLinkExpiryInput,
  SetContractStatusInput,
  SignAuthorInput,
  SignRecipientInput,
  UpdateContractInput,
  UpdateContractTemplateInput,
  UpsertContractSignersInput,
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

  /**
   * Defense-in-depth ownership check for the two foreign keys a contract
   * can reference. A contract must never point at another account's client
   * or deal — reject rather than silently attaching/trusting the id, so a
   * stray or crafted UUID can't link (and later leak) another workspace's
   * data through this contract's load/PDF/portal payloads.
   */
  private async assertReferencesBelongToAccount(
    accountId: string,
    refs: { client_id?: string | null; deal_id?: string | null },
  ) {
    if (refs.client_id) {
      const { data, error } = await this.db
        .from('clients')
        .select('id')
        .eq('id', refs.client_id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (error) this.throwErr(error);
      if (!data) {
        throw new Error('Client not found in this workspace');
      }
    }

    if (refs.deal_id) {
      const { data, error } = await this.db
        .from('pipeline_deals')
        .select('id')
        .eq('id', refs.deal_id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (error) this.throwErr(error);
      if (!data) {
        throw new Error('Deal not found in this workspace');
      }
    }
  }

  /** Server-side guard mirroring PaymentPlanSchema's refine — belt and braces
   * for any call into the service that bypasses the zod schema. */
  private assertPaymentPlanValid(paymentPlan: PaymentPlanItem[] | undefined) {
    if (paymentPlan === undefined) return;
    if (!isPaymentPlanTotalValid(paymentPlan)) {
      throw new Error('Payment plan percentages must total exactly 100%');
    }
  }

  private senderFromUser(user: {
    email?: string | null;
    user_metadata?: unknown;
  }) {
    const metadata =
      user.user_metadata && typeof user.user_metadata === 'object'
        ? (user.user_metadata as Record<string, unknown>)
        : {};
    return {
      first_name:
        typeof metadata.first_name === 'string' ? metadata.first_name : null,
      last_name:
        typeof metadata.last_name === 'string' ? metadata.last_name : null,
      email: user.email ?? null,
    };
  }

  private async resolveContractContent(params: {
    accountId: string;
    html: string;
    title?: string | null;
    totalPence?: number;
    currency?: string;
    paymentPlan?: PaymentPlanItem[];
    clientId?: string | null;
    authorName?: string | null;
    authorCompany?: string | null;
    sender?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    } | null;
  }): Promise<string> {
    if (!params.html || !hasSmartFieldTokens(params.html)) {
      return params.html;
    }

    const [{ data: account }, { data: client }] = await Promise.all([
      this.db
        .from('accounts')
        .select('name')
        .eq('id', params.accountId)
        .maybeSingle(),
      params.clientId
        ? this.db
            .from('clients')
            .select('display_name, first_name, last_name, company_name, email')
            .eq('id', params.clientId)
            .eq('account_id', params.accountId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return renderContractSmartFields(params.html, {
      client: client ?? null,
      contract: {
        title: params.title ?? null,
        total_pence: params.totalPence ?? 0,
        currency: params.currency ?? 'gbp',
        payment_plan: params.paymentPlan ?? [],
      },
      sender: params.sender ?? null,
      accountName: account?.name ?? null,
      authorName: params.authorName ?? null,
      authorCompany: params.authorCompany ?? null,
    });
  }

  /**
   * Ensure `contract` has a public_token that is neither revoked nor
   * expired, generating (or rotating) one with a fresh expiry when needed.
   * Rotating on re-send/re-share means a previously revoked token can never
   * be resurrected by a later "send" action.
   */
  private async ensureActivePublicToken(params: {
    accountId: string;
    contractId: string;
    expiryDays?: number;
    contract: {
      public_token?: string | null;
      public_token_revoked_at?: string | null;
      public_token_expires_at?: string | null;
    };
  }): Promise<{ token: string; expiresAt: string | null }> {
    const { contract } = params;
    const hasUsableToken =
      Boolean(contract.public_token) &&
      !contract.public_token_revoked_at &&
      !(
        contract.public_token_expires_at &&
        new Date(contract.public_token_expires_at).getTime() <= Date.now()
      );

    if (hasUsableToken) {
      return {
        token: contract.public_token as string,
        expiresAt: contract.public_token_expires_at ?? null,
      };
    }

    const { randomBytes } = await import('crypto');
    const public_token = randomBytes(32).toString('hex');
    const public_token_expires_at = computeContractPublicTokenExpiry(
      undefined,
      params.expiryDays ?? undefined,
    );

    const { error } = await this.db
      .from('contracts')
      .update({
        public_token,
        public_token_expires_at,
        public_token_revoked_at: null,
      })
      .eq('id', params.contractId)
      .eq('account_id', params.accountId);
    if (error) this.throwErr(error);

    return { token: public_token, expiresAt: public_token_expires_at };
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

  private versionSnapshotFields(record: {
    title?: string | null;
    content_html?: string | null;
    total_pence?: number | null;
    currency?: string | null;
    payment_plan?: unknown;
    author_type?: string | null;
    author_name?: string | null;
    author_company?: string | null;
    recipient_type?: string | null;
    recipient_name?: string | null;
    recipient_company?: string | null;
    recipient_email?: string | null;
  }) {
    return {
      title: record.title?.trim() || 'Agreement',
      content_html: record.content_html ?? '',
      total_pence: record.total_pence ?? 0,
      currency: record.currency ?? 'gbp',
      payment_plan: this.parsePaymentPlan(record.payment_plan),
      author_type: record.author_type ?? null,
      author_name: record.author_name ?? null,
      author_company: record.author_company ?? null,
      recipient_type: record.recipient_type ?? null,
      recipient_name: record.recipient_name ?? null,
      recipient_company: record.recipient_company ?? null,
      recipient_email: record.recipient_email ?? null,
    };
  }

  private hasUnpublishedDraft(contract: {
    current_version_id?: string | null;
    sent_version_id?: string | null;
  }) {
    return Boolean(
      contract.current_version_id &&
        contract.sent_version_id &&
        contract.current_version_id !== contract.sent_version_id,
    );
  }

  private async loadVersion(id: string | null | undefined) {
    if (!id) return null;
    const { data, error } = await this.db
      .from('contract_versions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) this.throwErr(error);
    return data;
  }

  private async listVersions(contractId: string, accountId: string) {
    const { data, error } = await this.db
      .from('contract_versions')
      .select(
        'id, version_number, status, content_hash, frozen_at, superseded_at, created_at, author_signed_at, recipient_signed_at',
      )
      .eq('contract_id', contractId)
      .eq('account_id', accountId)
      .order('version_number', { ascending: false });
    if (error) this.throwErr(error);
    return data ?? [];
  }

  private async listSigners(contractId: string, versionId?: string | null) {
    let q = this.db
      .from('contract_signers')
      .select(
        'id, version_id, signing_order, role, party_type, name, email, company, signature_type, signature_data, signed_at',
      )
      .eq('contract_id', contractId)
      .order('signing_order', { ascending: true });
    if (versionId) q = q.eq('version_id', versionId);
    const { data, error } = await q;
    if (error) this.throwErr(error);
    return data ?? [];
  }

  private async nextVersionNumber(contractId: string) {
    const { data, error } = await this.db
      .from('contract_versions')
      .select('version_number')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) this.throwErr(error);
    return (data?.version_number ?? 0) + 1;
  }

  private async insertDraftVersion(params: {
    accountId: string;
    contractId: string;
    versionNumber: number;
    record: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const fields = this.versionSnapshotFields(params.record);
    const content_hash = hashVersionSnapshot(fields);
    const { data, error } = await this.db
      .from('contract_versions')
      .insert({
        account_id: params.accountId,
        contract_id: params.contractId,
        version_number: params.versionNumber,
        status: 'draft',
        content_hash,
        created_by: params.createdBy ?? null,
        ...fields,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: params.accountId,
      contractId: params.contractId,
      eventType: 'version_created',
      payload: {
        version_id: data.id,
        version_number: params.versionNumber,
        content_hash,
      },
      actorId: params.createdBy ?? null,
    });

    return data;
  }

  private async persistDraftVersionSnapshot(params: {
    versionId: string;
    record: Record<string, unknown>;
  }) {
    const fields = this.versionSnapshotFields(params.record);
    const content_hash = hashVersionSnapshot(fields);
    const { data, error } = await this.db
      .from('contract_versions')
      .update({ ...fields, content_hash })
      .eq('id', params.versionId)
      .eq('status', 'draft')
      .select()
      .maybeSingle();
    if (error) this.throwErr(error);
    if (!data) {
      throw new Error('This version is frozen and cannot be edited');
    }
    return data;
  }

  private async ensureDefaultSigners(params: {
    accountId: string;
    contractId: string;
    versionId: string;
    record: {
      author_type?: string | null;
      author_name?: string | null;
      author_company?: string | null;
      author_signature_type?: string | null;
      author_signature_data?: string | null;
      author_signed_at?: string | null;
      recipient_type?: string | null;
      recipient_name?: string | null;
      recipient_company?: string | null;
      recipient_email?: string | null;
      recipient_signature_type?: string | null;
      recipient_signature_data?: string | null;
      recipient_signed_at?: string | null;
    };
  }) {
    const existing = await this.listSigners(params.contractId, params.versionId);
    if (existing.length > 0) return existing;

    const { data, error } = await this.db
      .from('contract_signers')
      .insert([
        {
          account_id: params.accountId,
          contract_id: params.contractId,
          version_id: params.versionId,
          signing_order: 1,
          role: 'author',
          party_type: params.record.author_type ?? null,
          name: params.record.author_name ?? null,
          company: params.record.author_company ?? null,
          signature_type: params.record.author_signature_type ?? null,
          signature_data: params.record.author_signature_data ?? null,
          signed_at: params.record.author_signed_at ?? null,
        },
        {
          account_id: params.accountId,
          contract_id: params.contractId,
          version_id: params.versionId,
          signing_order: 2,
          role: 'signer',
          party_type: params.record.recipient_type ?? null,
          name: params.record.recipient_name ?? null,
          email: params.record.recipient_email ?? null,
          company: params.record.recipient_company ?? null,
          signature_type: params.record.recipient_signature_type ?? null,
          signature_data: params.record.recipient_signature_data ?? null,
          signed_at: params.record.recipient_signed_at ?? null,
        },
      ])
      .select();
    if (error) this.throwErr(error);
    return data ?? [];
  }

  private async copySignersToVersion(params: {
    accountId: string;
    contractId: string;
    fromVersionId: string | null;
    toVersionId: string;
    record: Record<string, unknown>;
  }) {
    const source = params.fromVersionId
      ? await this.listSigners(params.contractId, params.fromVersionId)
      : [];
    if (source.length === 0) {
      return this.ensureDefaultSigners({
        accountId: params.accountId,
        contractId: params.contractId,
        versionId: params.toVersionId,
        record: params.record,
      });
    }

    const rows = source.map((signer: Record<string, unknown>) => ({
      account_id: params.accountId,
      contract_id: params.contractId,
      version_id: params.toVersionId,
      signing_order: signer.signing_order,
      role: signer.role,
      party_type: signer.party_type ?? null,
      name: signer.name ?? null,
      email: signer.email ?? null,
      company: signer.company ?? null,
      signature_type: null,
      signature_data: null,
      signed_at: null,
    }));
    const { data, error } = await this.db
      .from('contract_signers')
      .insert(rows)
      .select();
    if (error) this.throwErr(error);
    return data ?? [];
  }

  /**
   * Freeze the working snapshot as the active sent version.
   * Never mutates an already-frozen row: a new draft is promoted instead,
   * and the previous sent version is marked superseded.
   */
  private async freezeAndPromoteVersion(params: {
    accountId: string;
    contractId: string;
    contract: Record<string, unknown>;
    actorId?: string | null;
    signingExpiresAt?: string | null;
  }) {
    const contract = params.contract;
    const now = new Date().toISOString();
    let current = await this.loadVersion(
      (contract.current_version_id as string | null) ?? null,
    );
    const previousSentId = (contract.sent_version_id as string | null) ?? null;

    const sourceRecord =
      current?.status === 'draft' ? { ...contract, ...current } : contract;
    const fields = this.versionSnapshotFields(sourceRecord);
    const content_hash = hashVersionSnapshot(fields);

    if (current?.status === 'sent' || current?.status === 'signed') {
      if (current.id === previousSentId) {
        return current;
      }
    }

    if (current?.status === 'draft') {
      const authorSignedAt =
        current.author_signed_at ?? contract.author_signed_at ?? null;
      const { data, error } = await this.db
        .from('contract_versions')
        .update({
          ...fields,
          content_hash,
          status: 'sent',
          frozen_at: now,
          author_type: fields.author_type,
          author_name: fields.author_name,
          author_company: fields.author_company,
          author_signature_type:
            current.author_signature_type ??
            contract.author_signature_type ??
            null,
          author_signature_data:
            current.author_signature_data ??
            contract.author_signature_data ??
            null,
          author_signed_at: authorSignedAt,
        })
        .eq('id', current.id)
        .eq('status', 'draft')
        .select()
        .maybeSingle();
      if (error) this.throwErr(error);
      if (!data) {
        throw new Error('This version is frozen and cannot be sent again');
      }
      current = data;
    } else {
      const versionNumber = await this.nextVersionNumber(params.contractId);
      const { data, error } = await this.db
        .from('contract_versions')
        .insert({
          account_id: params.accountId,
          contract_id: params.contractId,
          version_number: versionNumber,
          status: 'sent',
          content_hash,
          frozen_at: now,
          created_by: params.actorId ?? null,
          author_signature_type: contract.author_signature_type ?? null,
          author_signature_data: contract.author_signature_data ?? null,
          author_signed_at: contract.author_signed_at ?? null,
          ...fields,
        })
        .select()
        .single();
      if (error) this.throwErr(error);
      current = data;
      await this.logEvent({
        accountId: params.accountId,
        contractId: params.contractId,
        eventType: 'version_created',
        payload: {
          version_id: current.id,
          version_number: current.version_number,
          content_hash,
        },
        actorId: params.actorId ?? null,
      });
    }

    if (previousSentId && previousSentId !== current.id) {
      const { error: superError } = await this.db
        .from('contract_versions')
        .update({
          status: 'superseded',
          superseded_at: now,
          superseded_by: current.id,
        })
        .eq('id', previousSentId);
      if (superError) this.throwErr(superError);
      await this.logEvent({
        accountId: params.accountId,
        contractId: params.contractId,
        eventType: 'version_superseded',
        payload: {
          version_id: previousSentId,
          superseded_by: current.id,
          version_number: current.version_number,
        },
        actorId: params.actorId ?? null,
      });
    }

    const contractPatch: Record<string, unknown> = {
      sent_version_id: current.id,
      current_version_id: current.id,
      current_version_number: current.version_number,
      title: fields.title,
      content_html: fields.content_html,
      total_pence: fields.total_pence,
      currency: fields.currency,
      payment_plan: fields.payment_plan,
      author_type: fields.author_type,
      author_name: fields.author_name,
      author_company: fields.author_company,
      recipient_type: fields.recipient_type,
      recipient_name: fields.recipient_name,
      recipient_company: fields.recipient_company,
      recipient_email: fields.recipient_email,
      author_signature_type: current.author_signature_type ?? null,
      author_signature_data: current.author_signature_data ?? null,
      author_signed_at: current.author_signed_at ?? null,
    };
    if (previousSentId && previousSentId !== current.id) {
      contractPatch.recipient_signature_type = null;
      contractPatch.recipient_signature_data = null;
      contractPatch.recipient_signed_at = null;
      contractPatch.recipient_declined_at = null;
      contractPatch.recipient_decline_reason = null;
    }
    if (params.signingExpiresAt !== undefined) {
      contractPatch.signing_expires_at = params.signingExpiresAt;
    }

    const { error: contractError } = await this.db
      .from('contracts')
      .update(contractPatch)
      .eq('id', params.contractId)
      .eq('account_id', params.accountId);
    if (contractError) this.throwErr(contractError);

    await this.logEvent({
      accountId: params.accountId,
      contractId: params.contractId,
      eventType: 'version_sent',
      payload: {
        version_id: current.id,
        version_number: current.version_number,
        content_hash,
      },
      actorId: params.actorId ?? null,
    });

    await this.ensureDefaultSigners({
      accountId: params.accountId,
      contractId: params.contractId,
      versionId: current.id,
      record: {
        ...fields,
        author_signature_type: current.author_signature_type,
        author_signature_data: current.author_signature_data,
        author_signed_at: current.author_signed_at,
      },
    });

    return current;
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
      includeArchived = false,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from('contracts')
      .select('*, clients(display_name)', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status === 'archived') {
      q = q.not('archived_at', 'is', null);
    } else if (!includeArchived) {
      q = q.is('archived_at', null);
    }

    if (status === 'unsigned') {
      q = q
        .in('status', ['draft', 'ready_to_sign', 'sent'])
        .or('author_signed_at.is.null,recipient_signed_at.is.null');
    } else if (status && status !== 'all' && status !== 'archived') {
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

    // account_id filters below are defense-in-depth: client_id/deal_id are
    // validated against the contract's account at write time (see
    // assertReferencesBelongToAccount), but we still scope reads so a
    // pre-existing/legacy mismatch can never leak another workspace's
    // client or deal into this contract's payload.
    const clientPromise = contract.client_id
      ? this.db
          .from('clients')
          .select(
            'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', contract.client_id)
          .eq('account_id', contract.account_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const dealPromise = contract.deal_id
      ? this.db
          .from('pipeline_deals')
          .select('id, title, client_id')
          .eq('id', contract.deal_id)
          .eq('account_id', contract.account_id)
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

    const versions = await this.listVersions(contract.id, params.accountId);
    const currentVersion = await this.loadVersion(contract.current_version_id);
    const sentVersion = await this.loadVersion(contract.sent_version_id);
    const unpublished = this.hasUnpublishedDraft(contract);
    const working = unpublished && currentVersion ? currentVersion : contract;
    const workingSigners = await this.listSigners(
      contract.id,
      (unpublished ? currentVersion?.id : sentVersion?.id ?? currentVersion?.id) ??
        null,
    );
    const { data: attachments } = await this.db
      .from('contract_attachments')
      .select('id, file_name, content_type, byte_size, created_at')
      .eq('contract_id', contract.id)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    return {
      ...contract,
      title: working.title ?? contract.title,
      content_html: working.content_html ?? contract.content_html,
      total_pence: working.total_pence ?? contract.total_pence,
      currency: working.currency ?? contract.currency,
      payment_plan: this.parsePaymentPlan(working.payment_plan),
      author_type: working.author_type ?? contract.author_type,
      author_name: working.author_name ?? contract.author_name,
      author_company: working.author_company ?? contract.author_company,
      author_signature_type:
        working.author_signature_type ?? contract.author_signature_type,
      author_signature_data:
        working.author_signature_data ?? contract.author_signature_data,
      author_signed_at: unpublished
        ? (currentVersion?.author_signed_at ?? null)
        : contract.author_signed_at,
      recipient_type: working.recipient_type ?? contract.recipient_type,
      recipient_name: working.recipient_name ?? contract.recipient_name,
      recipient_company: working.recipient_company ?? contract.recipient_company,
      recipient_email: working.recipient_email ?? contract.recipient_email,
      recipient_signature_type: unpublished
        ? (currentVersion?.recipient_signature_type ?? null)
        : contract.recipient_signature_type,
      recipient_signature_data: unpublished
        ? (currentVersion?.recipient_signature_data ?? null)
        : contract.recipient_signature_data,
      recipient_signed_at: unpublished
        ? (currentVersion?.recipient_signed_at ?? null)
        : contract.recipient_signed_at,
      client,
      deal,
      preferred_send_email,
      preferred_send_source,
      versions,
      signers: workingSigners,
      attachments: attachments ?? [],
      current_version: currentVersion,
      sent_version: sentVersion,
      has_unpublished_version: unpublished,
      sent_version_number: sentVersion?.version_number ?? null,
      version_id: currentVersion?.id ?? null,
      content_hash: currentVersion?.content_hash ?? null,
    };
  }

  async createContract(input: CreateContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    await this.assertReferencesBelongToAccount(input.accountId, {
      client_id: input.client_id,
      deal_id: input.deal_id,
    });
    this.assertPaymentPlanValid(input.payment_plan);

    const currency = input.currency
      ? normalizeWorkspaceCurrency(input.currency)
      : await getWorkspaceCurrencyWithClient(this.db, input.accountId);

    let title = input.title ?? 'Agreement';
    let contentHtml = input.content_html ?? '';
    let totalPence = input.total_pence ?? 0;
    let paymentPlan = input.payment_plan ?? [];

    if (input.template_id) {
      const { data: template, error: templateError } = await this.db
        .from('contract_templates')
        .select(
          'id, name, content_html, default_title, default_total_pence, default_payment_plan',
        )
        .eq('id', input.template_id)
        .eq('account_id', input.accountId)
        .maybeSingle();
      if (templateError) this.throwErr(templateError);
      if (!template) throw new Error('Template not found in this workspace');

      if (!input.title) {
        title = template.default_title?.trim() || template.name || 'Agreement';
      }
      if (!input.content_html) {
        contentHtml = template.content_html ?? '';
      }
      if (input.total_pence == null || input.total_pence === 0) {
        totalPence = template.default_total_pence ?? 0;
      }
      if (!input.payment_plan || input.payment_plan.length === 0) {
        paymentPlan = this.parsePaymentPlan(template.default_payment_plan);
        this.assertPaymentPlanValid(paymentPlan);
      }
    }

    contentHtml = await this.resolveContractContent({
      accountId: input.accountId,
      html: contentHtml,
      title,
      totalPence,
      currency,
      paymentPlan,
      clientId: input.client_id ?? null,
      authorName: null,
      authorCompany: null,
      sender: this.senderFromUser(user),
    });

    const { data: contract, error } = await this.db
      .from('contracts')
      .insert({
        account_id: input.accountId,
        client_id: input.client_id ?? null,
        deal_id: input.deal_id ?? null,
        proposal_id: input.proposal_id ?? null,
        title,
        content_html: contentHtml,
        status: 'draft',
        total_pence: totalPence,
        currency,
        payment_plan: paymentPlan,
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

    const version = await this.insertDraftVersion({
      accountId: input.accountId,
      contractId: contract.id,
      versionNumber: 1,
      record: contract,
      createdBy: user.id,
    });
    const { error: versionLinkError } = await this.db
      .from('contracts')
      .update({
        current_version_id: version.id,
        current_version_number: 1,
      })
      .eq('id', contract.id)
      .eq('account_id', input.accountId);
    if (versionLinkError) this.throwErr(versionLinkError);

    await this.ensureDefaultSigners({
      accountId: input.accountId,
      contractId: contract.id,
      versionId: version.id,
      record: contract,
    });

    return {
      ...contract,
      current_version_id: version.id,
      current_version_number: 1,
    };
  }

  async updateContract(input: UpdateContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: existing, error: existingError } = await this.db
      .from('contracts')
      .select(
        'status, content_html, title, total_pence, currency, payment_plan, client_id, author_name, author_company, current_version_id, sent_version_id',
      )
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (existingError) this.throwErr(existingError);
    if (existing?.status === 'cancelled') {
      throw new Error('Cancelled contracts cannot be edited');
    }

    const currentVersion = await this.loadVersion(existing.current_version_id);
    const unpublished = this.hasUnpublishedDraft(existing);
    const canEditDraftVersion = currentVersion?.status === 'draft';
    if (!canEditDraftVersion) {
      throw new Error(
        'This version is frozen. Create a new version to edit body or terms.',
      );
    }

    await this.assertReferencesBelongToAccount(input.accountId, {
      client_id: input.client_id,
      deal_id: input.deal_id,
    });
    this.assertPaymentPlanValid(input.payment_plan);

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

    const nextHtml =
      (payload.content_html as string | undefined) ??
      (existing.content_html as string | undefined) ??
      '';
    if (hasSmartFieldTokens(nextHtml)) {
      payload.content_html = await this.resolveContractContent({
        accountId: input.accountId,
        html: nextHtml,
        title:
          (payload.title as string | undefined) ??
          (existing.title as string | undefined) ??
          null,
        totalPence:
          (payload.total_pence as number | undefined) ??
          (existing.total_pence as number | undefined) ??
          0,
        currency:
          (payload.currency as string | undefined) ??
          (existing.currency as string | undefined) ??
          'gbp',
        paymentPlan:
          payload.payment_plan !== undefined
            ? this.parsePaymentPlan(payload.payment_plan)
            : this.parsePaymentPlan(existing.payment_plan),
        clientId:
          payload.client_id !== undefined
            ? (payload.client_id as string | null)
            : (existing.client_id as string | null),
        authorName:
          (payload.author_name as string | undefined) ??
          (existing.author_name as string | undefined) ??
          null,
        authorCompany:
          (payload.author_company as string | undefined) ??
          (existing.author_company as string | undefined) ??
          null,
        sender: this.senderFromUser(user),
      });
    }

    // Unpublished drafts of a sent/signed contract must not mutate the
    // frozen live row — only the draft version snapshot changes until send.
    if (unpublished) {
      const draftRecord = { ...existing, ...payload };
      const version = await this.persistDraftVersionSnapshot({
        versionId: currentVersion.id,
        record: draftRecord,
      });
      await this.logEvent({
        accountId: input.accountId,
        contractId: input.contractId,
        eventType: 'updated',
        payload: {
          fields: Object.keys(payload),
          version_id: version.id,
          version_number: version.version_number,
        },
        actorId: user.id,
      });
      return {
        ...existing,
        ...payload,
        ...this.versionSnapshotFields(version),
        id: input.contractId,
        account_id: input.accountId,
        current_version_id: version.id,
        has_unpublished_version: true,
      };
    }

    const { data, error } = await this.db
      .from('contracts')
      .update(payload)
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    if (currentVersion?.id) {
      await this.persistDraftVersionSnapshot({
        versionId: currentVersion.id,
        record: data,
      });
    }

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'updated',
      payload: { fields: Object.keys(payload) },
      actorId: user.id,
    });

    return data;
  }


  /**
   * Start a new draft version of a sent/signed contract.
   *
   * The live sent snapshot is left untouched (portal/PDF continue to
   * serve it). The editor switches to the new draft; it only becomes the
   * live agreement after it is sent (and re-signed).
   */
  async createNewVersion(input: CreateContractVersionInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error } = await this.db
      .from('contracts')
      .select('*')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (contract.status === 'cancelled') {
      throw new Error('Cancelled contracts cannot be versioned');
    }
    if (!['ready_to_sign', 'sent', 'signed'].includes(contract.status)) {
      throw new Error('Only sent or signed contracts can start a new version');
    }
    if (this.hasUnpublishedDraft(contract)) {
      throw new Error('A new version is already in progress');
    }

    const source =
      (await this.loadVersion(contract.sent_version_id)) ??
      (await this.loadVersion(contract.current_version_id)) ??
      contract;
    const versionNumber = await this.nextVersionNumber(input.contractId);
    const version = await this.insertDraftVersion({
      accountId: input.accountId,
      contractId: input.contractId,
      versionNumber,
      record: source,
      createdBy: user.id,
    });

    await this.copySignersToVersion({
      accountId: input.accountId,
      contractId: input.contractId,
      fromVersionId: contract.sent_version_id ?? contract.current_version_id,
      toVersionId: version.id,
      record: source,
    });

    const { error: linkError } = await this.db
      .from('contracts')
      .update({
        current_version_id: version.id,
        current_version_number: versionNumber,
      })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);
    if (linkError) this.throwErr(linkError);

    return {
      ...contract,
      current_version_id: version.id,
      current_version_number: versionNumber,
      has_unpublished_version: true,
      current_version: version,
    };
  }

  /**
   * Replace additional signers (order 3+) on the working draft version.
   * Author (1) and recipient (2) stay owned by the existing two-party
   * fields so Phase 1–3 behaviour is unchanged.
   */
  async upsertAdditionalSigners(input: UpsertContractSignersInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error } = await this.db
      .from('contracts')
      .select(
        'id, status, current_version_id, sent_version_id, author_type, author_name, author_company, recipient_type, recipient_name, recipient_company, recipient_email',
      )
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    const currentVersion = await this.loadVersion(contract.current_version_id);
    if (currentVersion?.status !== 'draft') {
      throw new Error(
        'Additional signers can only be changed on a draft version',
      );
    }

    await this.ensureDefaultSigners({
      accountId: input.accountId,
      contractId: input.contractId,
      versionId: currentVersion.id,
      record: contract,
    });

    const { error: deleteError } = await this.db
      .from('contract_signers')
      .delete()
      .eq('contract_id', input.contractId)
      .eq('version_id', currentVersion.id)
      .gte('signing_order', 3);
    if (deleteError) this.throwErr(deleteError);

    if (input.signers.length > 0) {
      const { error: insertError } = await this.db
        .from('contract_signers')
        .insert(
          input.signers.map((signer) => ({
            account_id: input.accountId,
            contract_id: input.contractId,
            version_id: currentVersion.id,
            signing_order: signer.signing_order,
            role: 'signer',
            party_type: signer.party_type ?? 'individual',
            name: signer.name,
            email: signer.email ?? null,
            company: signer.company ?? null,
          })),
        );
      if (insertError) this.throwErr(insertError);
    }

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'signers_updated',
      payload: {
        version_id: currentVersion.id,
        additional_count: input.signers.length,
      },
      actorId: user.id,
    });

    return this.listSigners(input.contractId, currentVersion.id);
  }

  /**
   * Archive / restore a contract.
   *
   * Archiving is a reversible flag, never a delete: the row (and any
   * signatures on it) is retained and simply drops out of the default list
   * view. Signed contracts are therefore safe to archive — hard deletion
   * stays restricted to unsigned drafts in deleteContract.
   */
  async archiveContract(input: ArchiveContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: existing, error } = await this.db
      .from('contracts')
      .select('id, archived_at')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !existing) this.throwErr(error, 'Contract not found');

    const alreadyInTargetState = input.archived
      ? Boolean(existing.archived_at)
      : !existing.archived_at;
    if (alreadyInTargetState) {
      return { archived: input.archived, changed: false };
    }

    const { error: updateError } = await this.db
      .from('contracts')
      .update({
        archived_at: input.archived ? new Date().toISOString() : null,
      })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);
    if (updateError) this.throwErr(updateError);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: input.archived ? 'archived' : 'restored',
      actorId: user.id,
    });

    return { archived: input.archived, changed: true };
  }

  /**
   * Duplicate a contract as a brand new draft.
   *
   * Everything that records the *execution* of the original — signatures,
   * signed/sent timestamps, public token and its expiry/revocation, email
   * delivery state, generated invoices, decline details — is deliberately
   * omitted, so a copy can never masquerade as an already-signed agreement
   * or inherit a live signing link.
   */
  async duplicateContract(input: DuplicateContractInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: source, error } = await this.db
      .from('contracts')
      .select('*')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !source) this.throwErr(error, 'Contract not found');

    const { data: created, error: createError } = await this.db
      .from('contracts')
      .insert({
        account_id: input.accountId,
        client_id: source.client_id,
        deal_id: source.deal_id,
        // A duplicate is not the document the proposal was accepted against.
        proposal_id: null,
        title: `${source.title?.trim() || 'Agreement'} (copy)`,
        content_html: source.content_html ?? '',
        status: 'draft',
        total_pence: source.total_pence ?? 0,
        currency: source.currency,
        payment_plan: source.payment_plan ?? [],
        auto_send_on_approval: source.auto_send_on_approval ?? false,
        recipient_email: source.recipient_email,
        recipient_name: source.recipient_name,
        recipient_company: source.recipient_company,
        recipient_type: source.recipient_type,
        author_type: source.author_type,
        author_name: source.author_name,
        author_company: source.author_company,
        email_subject: source.email_subject,
        email_body: source.email_body,
        email_signature: source.email_signature,
        private_note: source.private_note,
        created_by: user.id,
      })
      .select()
      .single();
    if (createError || !created) {
      this.throwErr(createError, 'Could not duplicate contract');
    }

    await this.logEvent({
      accountId: input.accountId,
      contractId: created.id,
      eventType: 'duplicated',
      payload: { source_contract_id: input.contractId },
      actorId: user.id,
    });

    const version = await this.insertDraftVersion({
      accountId: input.accountId,
      contractId: created.id,
      versionNumber: 1,
      record: created,
      createdBy: user.id,
    });
    await this.db
      .from('contracts')
      .update({
        current_version_id: version.id,
        current_version_number: 1,
      })
      .eq('id', created.id)
      .eq('account_id', input.accountId);
    await this.ensureDefaultSigners({
      accountId: input.accountId,
      contractId: created.id,
      versionId: version.id,
      record: created,
    });

    return { ...created, current_version_id: version.id, current_version_number: 1 };
  }

  /**
   * Recipient declines the agreement from the public portal (no auth).
   *
   * Recorded as `cancelled` plus recipient_declined_at / decline reason
   * rather than a brand new status value, so every existing status check
   * (and the contracts status CHECK constraint) keeps working unchanged and
   * a declined agreement is treated as not-signable everywhere. The public
   * link is revoked at the same time: once declined, the contract must not
   * remain signable through the same URL.
   */
  async declineRecipient(input: DeclineRecipientInput) {
    const { data: contract, error } = await this.db
      .from('contracts')
      .select(
        'id, account_id, status, author_signed_at, recipient_signed_at, public_token_revoked_at, public_token_expires_at',
      )
      .eq('public_token', input.token)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (!checkContractTokenAccess(contract).accessible) {
      throw new Error('This signing link is no longer available');
    }
    if (contract.recipient_signed_at) {
      throw new Error('This contract has already been signed');
    }
    if (!['ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error('This contract can no longer be declined');
    }

    const reason = input.reason?.trim() || null;
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await this.db
      .from('contracts')
      .update({
        status: 'cancelled',
        recipient_declined_at: now,
        recipient_decline_reason: reason,
        public_token_revoked_at: now,
      })
      .eq('id', contract.id)
      .select()
      .single();
    if (updateError) this.throwErr(updateError);

    await this.logEvent({
      accountId: contract.account_id,
      contractId: contract.id,
      eventType: 'recipient_declined',
      payload: { reason, source: 'portal' },
      actorId: null,
    });

    return updated;
  }

  /**
   * Manually re-send a contract that is already out for signature — used
   * both for "Send reminder" (nudge a recipient who hasn't signed) and
   * "Resend" (retry after a failed delivery).
   *
   * Deliberately user-triggered: no scheduler or cron is involved. The
   * existing public token is reused when it is still live, and the attempt
   * is always recorded — success and failure alike — so the activity
   * timeline shows exactly what was sent, to whom, and whether it landed.
   */
  async sendContractReminder(input: SendContractReminderInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error } = await this.db
      .from('contracts')
      .select(
        'id, status, public_token, public_token_revoked_at, public_token_expires_at, author_signed_at, recipient_signed_at, recipient_email, sent_to_email',
      )
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (!contract.author_signed_at) {
      throw new Error('The author must sign the contract before sending');
    }
    if (contract.recipient_signed_at) {
      throw new Error('This contract has already been signed by the recipient');
    }
    if (!['ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error('Only contracts out for signature can be re-sent');
    }

    const recipientEmail =
      input.sent_to_email?.trim() ||
      contract.recipient_email ||
      contract.sent_to_email;
    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    // Reuses the live token; only mints a new one if the current link is
    // missing, revoked or expired (see ensureActivePublicToken).
    await this.ensureActivePublicToken({
      accountId: input.accountId,
      contractId: input.contractId,
      expiryDays: input.expiry_days,
      contract,
    });

    const now = new Date().toISOString();
    let deliveryStatus: 'sent' | 'failed' = 'sent';
    let deliveryError: string | null = null;

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
    } catch (sendError) {
      deliveryStatus = 'failed';
      deliveryError =
        sendError instanceof Error
          ? sendError.message
          : 'Email delivery failed';
    }

    const patch: Record<string, unknown> = {
      email_delivery_status: deliveryStatus,
      email_delivery_error: deliveryError,
      sent_to_email: recipientEmail,
    };
    if (deliveryStatus === 'sent') {
      patch.last_reminder_at = now;
      // A resend of a contract that never left "ready to sign" should still
      // move it into the sent state, exactly like sendContract does.
      if (contract.status !== 'sent') {
        patch.status = 'sent';
        patch.sent_at = now;
      }
    }

    const { error: updateError } = await this.db
      .from('contracts')
      .update(patch)
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);
    if (updateError) this.throwErr(updateError);

    const kind = input.kind ?? 'reminder';
    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType:
        deliveryStatus === 'sent'
          ? kind === 'resend'
            ? 'email_resent'
            : 'reminder_sent'
          : 'email_delivery_failed',
      payload: {
        recipient: recipientEmail,
        kind,
        ...(deliveryError ? { error: deliveryError } : {}),
      },
      actorId: user.id,
    });

    if (deliveryStatus === 'failed') {
      throw new Error(deliveryError ?? 'Email delivery failed');
    }

    return { sent: true, recipient: recipientEmail, last_reminder_at: now };
  }

  /**
   * Change how long the current shareable link stays valid, without
   * rotating the token. `expiry_days: null` clears the expiry entirely.
   * Only ever tightens/extends an existing, non-revoked link — reviving a
   * revoked one still requires an explicit send/share.
   */
  async setContractPortalLinkExpiry(input: SetContractPortalLinkExpiryInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error } = await this.db
      .from('contracts')
      .select('id, public_token, public_token_revoked_at')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (!contract.public_token) {
      throw new Error('This contract does not have a shareable link yet');
    }
    if (contract.public_token_revoked_at) {
      throw new Error('This shareable link has been revoked');
    }

    const expiresAt =
      input.expiry_days == null
        ? null
        : computeContractPublicTokenExpiry(new Date(), input.expiry_days);

    const { error: updateError } = await this.db
      .from('contracts')
      .update({ public_token_expires_at: expiresAt })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);
    if (updateError) this.throwErr(updateError);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'link_expiry_updated',
      payload: {
        expires_at: expiresAt,
        expiry_days: input.expiry_days ?? null,
      },
      actorId: user.id,
    });

    return { expires_at: expiresAt };
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

    const patch: Record<string, unknown> = { status: input.status };
    if (input.status === 'cancelled') {
      // Belt and braces: cancelled is already rejected by the public
      // token access check, but explicitly revoking too means the link
      // can never be resurrected by a later status change and shows up
      // clearly as revoked in the activity timeline.
      patch.public_token_revoked_at = new Date().toISOString();
    }

    const { data, error } = await this.db
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
      .select('*')
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

      await this.ensureActivePublicToken({
        accountId: input.accountId,
        contractId: input.contractId,
        expiryDays: input.expiry_days,
        contract,
      });

      await sendContractIssuedEmail({
        accountId: input.accountId,
        contractId: input.contractId,
        recipientEmail: testEmail,
        testOnly: true,
        sender: senderInfo,
      });
      return { test_sent: true };
    }

    const currentVersion = await this.loadVersion(contract.current_version_id);
    const unpublished = this.hasUnpublishedDraft(contract);
    const authorSignedAt = unpublished
      ? currentVersion?.author_signed_at
      : contract.author_signed_at;
    if (!authorSignedAt) {
      throw new Error('The author must sign the contract before sending');
    }

    if (unpublished) {
      if (!['ready_to_sign', 'sent', 'signed'].includes(contract.status)) {
        throw new Error('This contract cannot send a new version in its current state');
      }
    } else if (!['ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error(
        'Only contracts ready to sign or already sent can be emailed',
      );
    }

    const signingExpiresAt =
      input.signing_expiry_days == null
        ? unpublished
          ? null
          : contract.signing_expires_at
        : computeContractSigningExpiry(new Date(), input.signing_expiry_days);

    await this.freezeAndPromoteVersion({
      accountId: input.accountId,
      contractId: input.contractId,
      contract: {
        ...contract,
        author_signed_at: authorSignedAt,
        author_signature_type:
          currentVersion?.author_signature_type ?? contract.author_signature_type,
        author_signature_data:
          currentVersion?.author_signature_data ?? contract.author_signature_data,
      },
      actorId: user.id,
      signingExpiresAt,
    });

    await this.ensureActivePublicToken({
      accountId: input.accountId,
      contractId: input.contractId,
      contract,
    });

    const now = new Date().toISOString();
    const sentPatch: Record<string, unknown> = {
      status: 'sent',
      sent_at: now,
      sent_to_email: input.sent_to_email,
      recipient_email: input.sent_to_email,
    };
    if (input.signing_expiry_days != null) {
      sentPatch.signing_expires_at = computeContractSigningExpiry(
        new Date(),
        input.signing_expiry_days,
      );
    } else if (unpublished) {
      sentPatch.signing_expires_at = null;
    }
    const { data: updated, error } = await this.db
      .from('contracts')
      .update(sentPatch)
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'sent',
      payload: {
        sent_to_email: input.sent_to_email,
        version_id: updated.sent_version_id ?? null,
        version_number: updated.current_version_number ?? null,
      },
      actorId: user.id,
    });

    // Record whether delivery actually succeeded — a contract must never
    // look successfully sent when the email failed. The workflow state
    // (status/public link) has already moved on by this point, so we keep
    // it, but surface the failure for the UI and the activity timeline
    // instead of silently swallowing it.
    let emailDeliveryStatus: 'sent' | 'failed' = 'sent';
    let emailDeliveryError: string | null = null;
    try {
      await sendContractIssuedEmail({
        accountId: input.accountId,
        contractId: input.contractId,
        recipientEmail: input.sent_to_email,
        sender: senderInfo,
      });
    } catch (sendError) {
      emailDeliveryStatus = 'failed';
      emailDeliveryError =
        sendError instanceof Error
          ? sendError.message
          : 'Email delivery failed';
    }

    await this.db
      .from('contracts')
      .update({
        email_delivery_status: emailDeliveryStatus,
        email_delivery_error: emailDeliveryError,
      })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);

    if (emailDeliveryStatus === 'failed') {
      await this.logEvent({
        accountId: input.accountId,
        contractId: input.contractId,
        eventType: 'email_delivery_failed',
        payload: { error: emailDeliveryError, recipient: input.sent_to_email },
        actorId: user.id,
      });
    }

    return {
      ...updated,
      email_delivery_status: emailDeliveryStatus,
      email_delivery_error: emailDeliveryError,
    };
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

    const unpublished = this.hasUnpublishedDraft(contract);
    if (unpublished) {
      if (contract.status === 'cancelled') {
        throw new Error('This contract can no longer be signed by the author');
      }
    } else if (!['draft', 'ready_to_sign', 'sent'].includes(contract.status)) {
      throw new Error('This contract can no longer be signed by the author');
    }

    const now = new Date().toISOString();
    const sendAfterSign = input.send_after_sign ?? false;
    const recipientEmail =
      input.sent_to_email ??
      contract.recipient_email ??
      contract.sent_to_email ??
      null;

    const currentVersion = await this.loadVersion(contract.current_version_id);
    if (currentVersion?.status === 'draft') {
      const { error: versionSignError } = await this.db
        .from('contract_versions')
        .update({
          author_type: input.author_type,
          author_name: input.author_name,
          author_company: input.author_company ?? null,
          author_signature_type: input.author_signature_type,
          author_signature_data: input.author_signature_data,
          author_signed_at: now,
        })
        .eq('id', currentVersion.id)
        .eq('status', 'draft');
      if (versionSignError) this.throwErr(versionSignError);
      await this.ensureDefaultSigners({
        accountId: input.accountId,
        contractId: input.contractId,
        versionId: currentVersion.id,
        record: {
          ...contract,
          author_type: input.author_type,
          author_name: input.author_name,
          author_company: input.author_company ?? null,
        },
      });
      await this.db
        .from('contract_signers')
        .update({
          name: input.author_name,
          company: input.author_company ?? null,
          party_type: input.author_type,
          signature_type: input.author_signature_type,
          signature_data: input.author_signature_data,
          signed_at: now,
        })
        .eq('contract_id', input.contractId)
        .eq('version_id', currentVersion.id)
        .eq('role', 'author');
    }

    let status: 'ready_to_sign' | 'sent' = 'ready_to_sign';
    const patch: Record<string, unknown> = unpublished
      ? {}
      : {
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
      await this.freezeAndPromoteVersion({
        accountId: input.accountId,
        contractId: input.contractId,
        contract: {
          ...contract,
          author_type: input.author_type,
          author_name: input.author_name,
          author_company: input.author_company ?? null,
          author_signature_type: input.author_signature_type,
          author_signature_data: input.author_signature_data,
          author_signed_at: now,
          recipient_email: recipientEmail,
        },
        actorId: user.id,
      });
      await this.ensureActivePublicToken({
        accountId: input.accountId,
        contractId: input.contractId,
        contract,
      });
      status = 'sent';
      patch.status = 'sent';
      patch.sent_at = now;
      patch.sent_to_email = recipientEmail;
      patch.recipient_email = recipientEmail;
    } else if (!unpublished) {
      patch.status = 'ready_to_sign';
    }

    let updated = contract;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await this.db
        .from('contracts')
        .update(patch)
        .eq('id', input.contractId)
        .eq('account_id', input.accountId)
        .select()
        .single();
      if (error) this.throwErr(error);
      updated = data;
    }

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
      let emailDeliveryStatus: 'sent' | 'failed' = 'sent';
      let emailDeliveryError: string | null = null;
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
      } catch (sendError) {
        emailDeliveryStatus = 'failed';
        emailDeliveryError =
          sendError instanceof Error
            ? sendError.message
            : 'Email delivery failed';
      }

      // Same reasoning as sendContract: signing-and-sending must never
      // leave the contract looking successfully delivered when it wasn't.
      await this.db
        .from('contracts')
        .update({
          email_delivery_status: emailDeliveryStatus,
          email_delivery_error: emailDeliveryError,
        })
        .eq('id', input.contractId)
        .eq('account_id', input.accountId);

      if (emailDeliveryStatus === 'failed') {
        await this.logEvent({
          accountId: input.accountId,
          contractId: input.contractId,
          eventType: 'email_delivery_failed',
          payload: { error: emailDeliveryError, recipient: recipientEmail },
          actorId: user.id,
        });
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

    if (contract.public_token_revoked_at) {
      throw new Error('This signing link has been revoked');
    }
    if (
      contract.public_token_expires_at &&
      new Date(contract.public_token_expires_at).getTime() <= Date.now()
    ) {
      throw new Error('This signing link has expired');
    }

    if (isContractSigningExpired(contract.signing_expires_at)) {
      throw new Error('The signing deadline for this agreement has passed');
    }

    if (!['sent', 'ready_to_sign'].includes(contract.status)) {
      throw new Error('This contract is not available for signing');
    }

    const sentVersion = await this.loadVersion(contract.sent_version_id);
    if (sentVersion) {
      const match = checkFrozenVersionMatch({
        providedVersionId: input.version_id,
        providedContentHash: input.content_hash,
        expectedVersionId: sentVersion.id,
        expectedContentHash: sentVersion.content_hash,
        expectedVersionStatus: sentVersion.status,
      });
      if (!match.ok) {
        throw new Error(staleVersionErrorMessage(match.reason));
      }
    }

    if (!contract.author_signed_at) {
      throw new Error('The author must sign before the recipient');
    }

    const signers = sentVersion
      ? await this.listSigners(contract.id, sentVersion.id)
      : [];
    const targetSigner =
      (input.signer_id
        ? signers.find((signer: { id: string }) => signer.id === input.signer_id)
        : nextUnsignedSigner(
            signers.filter((signer: { role: string }) => signer.role !== 'author'),
          )) ??
      signers.find((signer: { role: string }) => signer.role === 'signer');

    if (signers.length > 0) {
      if (!targetSigner) {
        throw new Error('This contract has already been signed by all parties');
      }
      const turn = canSignerSign(signers, targetSigner.id);
      if (!turn.ok) {
        throw new Error(signerTurnErrorMessage(turn));
      }
    } else if (contract.recipient_signed_at) {
      throw new Error('This contract has already been signed by the recipient');
    }

    const now = new Date().toISOString();
    const isPrimaryRecipient =
      !targetSigner ||
      (targetSigner.role === 'signer' &&
        Number(targetSigner.signing_order) === 2);

    if (targetSigner) {
      const { error: signerError } = await this.db
        .from('contract_signers')
        .update({
          party_type: input.recipient_type,
          name: input.recipient_name,
          company: input.recipient_company ?? null,
          signature_type: input.recipient_signature_type,
          signature_data: input.recipient_signature_data,
          signed_at: now,
        })
        .eq('id', targetSigner.id);
      if (signerError) this.throwErr(signerError);
    }

    const recipientPatch: Record<string, unknown> = isPrimaryRecipient
      ? {
          recipient_type: input.recipient_type,
          recipient_name: input.recipient_name,
          recipient_company: input.recipient_company ?? null,
          recipient_signature_type: input.recipient_signature_type,
          recipient_signature_data: input.recipient_signature_data,
          recipient_signed_at: now,
        }
      : {};

    if (sentVersion && isPrimaryRecipient) {
      await this.db
        .from('contract_versions')
        .update({
          recipient_type: input.recipient_type,
          recipient_name: input.recipient_name,
          recipient_company: input.recipient_company ?? null,
          recipient_signature_type: input.recipient_signature_type,
          recipient_signature_data: input.recipient_signature_data,
          recipient_signed_at: now,
        })
        .eq('id', sentVersion.id);
    }

    const { data: updated, error } = Object.keys(recipientPatch).length
      ? await this.db
          .from('contracts')
          .update(recipientPatch)
          .eq('id', contract.id)
          .select()
          .single()
      : { data: contract, error: null };
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: contract.account_id,
      contractId: contract.id,
      eventType: 'recipient_signed',
      payload: {
        recipient_signature_type: input.recipient_signature_type,
        version_id: sentVersion?.id ?? null,
        signer_id: targetSigner?.id ?? null,
        signing_order: targetSigner?.signing_order ?? 2,
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
      } catch (notifyError) {
        // Non-blocking: the contract is still fully signed even if the
        // "signed" notification emails fail, but record it so the
        // failure is auditable instead of silently lost.
        await this.logEvent({
          accountId: contract.account_id,
          contractId: contract.id,
          eventType: 'signed_notification_failed',
          payload: {
            error:
              notifyError instanceof Error
                ? notifyError.message
                : 'Notification failed',
          },
          actorId: null,
        });
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

    // Reject draft, cancelled, revoked, and expired contracts — only
    // ready_to_sign / sent / signed contracts with a live token are
    // viewable through a public link.
    if (!checkContractTokenAccess(contract).accessible) {
      return null;
    }

    const clientPromise = contract.client_id
      ? this.db
          .from('clients')
          .select(
            'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', contract.client_id)
          .eq('account_id', contract.account_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const { data: account } = await this.db
      .from('accounts')
      .select('id, name, slug')
      .eq('id', contract.account_id)
      .maybeSingle();

    const { data: client } = await clientPromise;

    const sentVersion = await this.loadVersion(contract.sent_version_id);
    const signers = sentVersion
      ? await this.listSigners(contract.id, sentVersion.id)
      : await this.listSigners(contract.id, contract.current_version_id);
    const overlaid = overlayContractVersion(
      {
        ...contract,
        payment_plan: this.parsePaymentPlan(
          sentVersion?.payment_plan ?? contract.payment_plan,
        ),
      },
      sentVersion
        ? {
            ...sentVersion,
            payment_plan: this.parsePaymentPlan(sentVersion.payment_plan),
          }
        : null,
    );

    return {
      ...overlaid,
      client,
      account,
      signers,
      next_signer: nextUnsignedSigner(signers),
      signing_expires_at: contract.signing_expires_at ?? null,
      signing_expired: isContractSigningExpired(contract.signing_expires_at),
    };
  }

  async getContractPortalLink(
    input: GetContractPortalLinkInput,
  ): Promise<{ token: string; expires_at: string | null }> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: contract, error } = await this.db
      .from('contracts')
      .select(
        'id, status, public_token, public_token_revoked_at, public_token_expires_at, author_signed_at',
      )
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

    const { token, expiresAt } = await this.ensureActivePublicToken({
      accountId: input.accountId,
      contractId: input.contractId,
      expiryDays: input.expiry_days,
      contract,
    });

    return { token, expires_at: expiresAt };
  }

  /**
   * Revoke the contract's current shareable/portal link. The link (if any)
   * immediately stops working for the portal and `/api/contracts/pdf`; a
   * later send/share action mints a brand new token rather than reviving
   * this one (see ensureActivePublicToken).
   */
  async revokeContractPortalLink(
    input: RevokeContractPortalLinkInput,
  ): Promise<{ revoked: boolean }> {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const { data: contract, error } = await this.db
      .from('contracts')
      .select('id, public_token, public_token_revoked_at')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    if (!contract.public_token || contract.public_token_revoked_at) {
      return { revoked: false };
    }

    const { error: updateError } = await this.db
      .from('contracts')
      .update({ public_token_revoked_at: new Date().toISOString() })
      .eq('id', input.contractId)
      .eq('account_id', input.accountId);
    if (updateError) this.throwErr(updateError);

    await this.logEvent({
      accountId: input.accountId,
      contractId: input.contractId,
      eventType: 'link_revoked',
      actorId: user.id,
    });

    return { revoked: true };
  }

  /**
   * Activity timeline for the contract detail view, sourced from
   * contract_events. Gated by the same invoices.view permission as
   * getContract, and scoped to this account + contract so it can never
   * leak another workspace's events.
   */
  async listContractEvents(input: ListContractEventsInput) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');

    const { data: contract, error: contractError } = await this.db
      .from('contracts')
      .select('id')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (contractError) this.throwErr(contractError);
    if (!contract) throw new Error('Contract not found');

    const { data, error } = await this.db
      .from('contract_events')
      .select('id, event_type, payload, actor_id, created_at')
      .eq('contract_id', input.contractId)
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: false });
    if (error) this.throwErr(error);

    return data ?? [];
  }

  async listContractTemplates(input: ListContractTemplatesInput) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.view');
    const { data, error } = await this.db
      .from('contract_templates')
      .select(
        'id, name, content_html, default_title, default_total_pence, default_payment_plan, created_at, updated_at',
      )
      .eq('account_id', input.accountId)
      .order('updated_at', { ascending: false });
    if (error) this.throwErr(error);
    return data ?? [];
  }

  async createContractTemplate(input: CreateContractTemplateInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    this.assertPaymentPlanValid(input.default_payment_plan);
    const { data, error } = await this.db
      .from('contract_templates')
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        content_html: input.content_html ?? '',
        default_title: input.default_title?.trim() || null,
        default_total_pence: input.default_total_pence ?? 0,
        default_payment_plan: input.default_payment_plan ?? [],
        created_by: user.id,
      })
      .select()
      .single();
    if (error) this.throwErr(error);
    return data;
  }

  async updateContractTemplate(input: UpdateContractTemplateInput) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    this.assertPaymentPlanValid(input.default_payment_plan);
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.content_html !== undefined)
      payload.content_html = input.content_html;
    if (input.default_title !== undefined) {
      payload.default_title = input.default_title?.trim() || null;
    }
    if (input.default_total_pence !== undefined) {
      payload.default_total_pence = input.default_total_pence;
    }
    if (input.default_payment_plan !== undefined) {
      payload.default_payment_plan = input.default_payment_plan;
    }
    const { data, error } = await this.db
      .from('contract_templates')
      .update(payload)
      .eq('id', input.templateId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);
    return data;
  }

  async deleteContractTemplate(input: DeleteContractTemplateInput) {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const { error } = await this.db
      .from('contract_templates')
      .delete()
      .eq('id', input.templateId)
      .eq('account_id', input.accountId);
    if (error) this.throwErr(error);
    return { deleted: true };
  }

  async saveContractAsTemplate(input: SaveContractAsTemplateInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    const { data: contract, error } = await this.db
      .from('contracts')
      .select('title, content_html, total_pence, payment_plan')
      .eq('id', input.contractId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !contract) this.throwErr(error, 'Contract not found');

    const { data, error: createError } = await this.db
      .from('contract_templates')
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        content_html: contract.content_html ?? '',
        default_title: contract.title ?? null,
        default_total_pence: contract.total_pence ?? 0,
        default_payment_plan: contract.payment_plan ?? [],
        created_by: user.id,
      })
      .select()
      .single();
    if (createError) this.throwErr(createError);
    return data;
  }
}
