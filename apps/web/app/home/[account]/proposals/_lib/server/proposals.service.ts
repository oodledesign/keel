import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { Database } from '~/lib/database.types';

import {
  DEFAULT_PROPOSAL_EMAIL_BODY,
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
  DEFAULT_PROPOSAL_EMAIL_SUBJECT,
} from '../doc-smart-fields';
import type {
  CreateProposalInput,
  DeleteProposalInput,
  GetProposalForPortalInput,
  GetProposalInput,
  GetProposalPortalLinkInput,
  ListProposalsInput,
  SendProposalInput,
  SetProposalStatusInput,
  UpdateProposalInput,
  AddProposalCommentInput,
} from '../schema/proposals.schema';
import { sendProposalIssuedEmail } from './proposal-notifications';

export function createProposalsService(client: SupabaseClient<Database>) {
  return new ProposalsService(client);
}

class ProposalsService {
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

  async logEvent(params: {
    accountId: string;
    proposalId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    actorId?: string | null;
  }) {
    const { error } = await this.db.from('proposal_events').insert({
      account_id: params.accountId,
      proposal_id: params.proposalId,
      event_type: params.eventType,
      payload: params.payload ?? {},
      actor_id: params.actorId ?? null,
    });
    if (error) this.throwErr(error);
  }

  async listProposals(params: ListProposalsInput) {
    await this.ensureUser();

    const {
      accountId,
      page = 1,
      pageSize = 20,
      query,
      status,
      clientId,
      dealId,
      dateFrom,
      dateTo,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.db
      .from('proposals')
      .select(
        '*, clients(display_name), pipeline_deals(contact_name, company_name, name)',
        { count: 'exact' },
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status === 'unapproved') {
      q = q.eq('status', 'draft');
    } else if (status === 'pending') {
      q = q.in('status', ['sent', 'read']);
    } else if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    if (clientId) {
      q = q.eq('client_id', clientId);
    }
    if (dealId) {
      q = q.eq('deal_id', dealId);
    }
    if (dateFrom) {
      q = q.gte('sent_at', dateFrom);
    }
    if (dateTo) {
      q = q.lte('sent_at', dateTo);
    }
    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`title.ilike.${term},recipient_name.ilike.${term}`);
    }

    const { data, error, count } = await q;
    if (error) this.throwErr(error);
    return { data: data ?? [], total: count ?? 0 };
  }

  async getProposal(params: GetProposalInput) {
    await this.ensureUser();

    const { data: proposal, error: proposalError } = await this.db
      .from('proposals')
      .select('*')
      .eq('id', params.proposalId)
      .eq('account_id', params.accountId)
      .single();
    if (proposalError) this.throwErr(proposalError);
    if (!proposal) return null;

    const { data: comments, error: commentsError } = await this.db
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', params.proposalId)
      .order('created_at', { ascending: true });
    if (commentsError) this.throwErr(commentsError);

    let client = null;
    if (proposal.client_id) {
      const { data } = await this.db
        .from('clients')
        .select(
          'id, display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
        )
        .eq('id', proposal.client_id)
        .maybeSingle();
      client = data;
    }

    let deal = null;
    if (proposal.deal_id) {
      const { data } = await this.db
        .from('pipeline_deals')
        .select('id, name, contact_name, company_name, value, stage')
        .eq('id', proposal.deal_id)
        .maybeSingle();
      deal = data;
    }

    return { ...proposal, comments: comments ?? [], client, deal };
  }

  async createProposal(input: CreateProposalInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    if (!input.client_id && !input.deal_id) {
      throw new Error('Either client_id or deal_id is required');
    }

    const { data: proposal, error } = await this.db
      .from('proposals')
      .insert({
        account_id: input.accountId,
        client_id: input.client_id ?? null,
        deal_id: input.deal_id ?? null,
        title: input.title ?? 'Proposal',
        content_html: input.content_html ?? '',
        status: 'draft',
        recipient_name: input.recipient_name ?? null,
        recipient_email: input.recipient_email ?? null,
        total_pence: input.total_pence ?? null,
        currency: input.currency ?? 'gbp',
        expires_at: input.expires_at ?? null,
        private_note: input.private_note ?? null,
        email_subject: DEFAULT_PROPOSAL_EMAIL_SUBJECT,
        email_body: DEFAULT_PROPOSAL_EMAIL_BODY,
        email_signature: DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      proposalId: proposal.id,
      eventType: 'created',
      payload: {
        client_id: input.client_id ?? null,
        deal_id: input.deal_id ?? null,
      },
      actorId: user.id,
    });
    return proposal;
  }

  async updateProposal(input: UpdateProposalInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: existing, error: existingError } = await this.db
      .from('proposals')
      .select('status, client_id, deal_id')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .single();
    if (existingError) this.throwErr(existingError);
    if (existing?.status !== 'draft') {
      throw new Error('Sent or finalised proposals can no longer be edited');
    }

    const nextClientId =
      input.client_id !== undefined ? input.client_id : existing.client_id;
    const nextDealId = input.deal_id !== undefined ? input.deal_id : existing.deal_id;
    if (!nextClientId && !nextDealId) {
      throw new Error('Either client_id or deal_id is required');
    }

    const payload: Record<string, unknown> = {};
    if (input.client_id !== undefined) payload.client_id = input.client_id;
    if (input.deal_id !== undefined) payload.deal_id = input.deal_id;
    if (input.title !== undefined) payload.title = input.title;
    if (input.content_html !== undefined) payload.content_html = input.content_html;
    if (input.recipient_name !== undefined) payload.recipient_name = input.recipient_name;
    if (input.recipient_email !== undefined) payload.recipient_email = input.recipient_email;
    if (input.total_pence !== undefined) payload.total_pence = input.total_pence;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.expires_at !== undefined) payload.expires_at = input.expires_at;
    if (input.private_note !== undefined) payload.private_note = input.private_note;
    if (input.email_subject !== undefined) payload.email_subject = input.email_subject;
    if (input.email_body !== undefined) payload.email_body = input.email_body;
    if (input.email_signature !== undefined) payload.email_signature = input.email_signature;

    const { data, error } = await this.db
      .from('proposals')
      .update(payload)
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      proposalId: input.proposalId,
      eventType: 'updated',
      payload: { fields: Object.keys(payload) },
      actorId: user.id,
    });
    return data;
  }

  async deleteProposal(params: DeleteProposalInput) {
    await this.ensureUserAndPermission(params.accountId, 'invoices.edit');

    const { data: existing, error: existingError } = await this.db
      .from('proposals')
      .select('status')
      .eq('id', params.proposalId)
      .eq('account_id', params.accountId)
      .single();
    if (existingError) this.throwErr(existingError);
    if (existing?.status !== 'draft') {
      throw new Error('Only draft proposals can be deleted');
    }

    const { error } = await this.db
      .from('proposals')
      .delete()
      .eq('id', params.proposalId)
      .eq('account_id', params.accountId);
    if (error) this.throwErr(error);
  }

  async sendProposal(input: SendProposalInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: proposal, error: fetchError } = await this.db
      .from('proposals')
      .select('id, status, public_token')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError || !proposal) this.throwErr(fetchError, 'Proposal not found');

    const emailPatch: Record<string, unknown> = {};
    if (input.email_subject) emailPatch.email_subject = input.email_subject;
    if (input.email_body) emailPatch.email_body = input.email_body;
    if (input.email_signature) emailPatch.email_signature = input.email_signature;

    if (Object.keys(emailPatch).length > 0) {
      await this.db
        .from('proposals')
        .update(emailPatch)
        .eq('id', input.proposalId)
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

      let testToken = proposal.public_token;
      if (!testToken) {
        const { randomBytes } = await import('crypto');
        testToken = randomBytes(32).toString('hex');
        await this.db
          .from('proposals')
          .update({ public_token: testToken })
          .eq('id', input.proposalId)
          .eq('account_id', input.accountId);
      }

      await sendProposalIssuedEmail({
        accountId: input.accountId,
        proposalId: input.proposalId,
        recipientEmail: testEmail,
        testOnly: true,
        sender: senderInfo,
      });
      return { test_sent: true };
    }

    if (proposal.status !== 'draft') {
      throw new Error('Only draft proposals can be sent');
    }

    let public_token = proposal.public_token;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.db
      .from('proposals')
      .update({
        public_token,
        status: 'sent',
        sent_at: now,
        sent_to_email: input.sent_to_email,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      proposalId: input.proposalId,
      eventType: 'sent',
      payload: { sent_to_email: input.sent_to_email },
      actorId: user.id,
    });

    try {
      await sendProposalIssuedEmail({
        accountId: input.accountId,
        proposalId: input.proposalId,
        recipientEmail: input.sent_to_email,
        sender: senderInfo,
      });
    } catch {
      // Keep the proposal in sent state even if email delivery fails.
    }

    try {
      const { createDraftContractForProposal } = await import('./proposal-automation');
      await createDraftContractForProposal(input.proposalId);
    } catch (error) {
      console.error('[proposals] draft contract on send failed', error);
    }

    return updated;
  }

  async getProposalForPortal(params: GetProposalForPortalInput) {
    const { data: proposal, error: proposalError } = await this.db
      .from('proposals')
      .select('*')
      .eq('public_token', params.token)
      .single();
    if (proposalError || !proposal) return null;

    const { data: comments } = await this.db
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: true });

    let client = null;
    if (proposal.client_id) {
      const { data } = await this.db
        .from('clients')
        .select('id, display_name, first_name, last_name, company_name, email')
        .eq('id', proposal.client_id)
        .maybeSingle();
      client = data;
    }

    let deal = null;
    if (proposal.deal_id) {
      const { data } = await this.db
        .from('pipeline_deals')
        .select('id, name, contact_name, company_name')
        .eq('id', proposal.deal_id)
        .maybeSingle();
      deal = data;
    }

    return { ...proposal, comments: comments ?? [], client, deal };
  }

  async getProposalPortalLink(
    input: GetProposalPortalLinkInput,
  ): Promise<{ token: string }> {
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: proposal, error } = await this.db
      .from('proposals')
      .select('id, account_id, status, public_token')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .single();
    if (error || !proposal) this.throwErr(error, 'Proposal not found');

    if (!['sent', 'read', 'approved', 'declined'].includes(proposal.status)) {
      throw new Error('You can only create a portal link for a sent proposal');
    }

    let public_token = proposal.public_token as string | null;
    if (!public_token) {
      const { randomBytes } = await import('crypto');
      public_token = randomBytes(32).toString('hex');

      const { error: updateError } = await this.db
        .from('proposals')
        .update({ public_token })
        .eq('id', input.proposalId)
        .eq('account_id', input.accountId);
      if (updateError) this.throwErr(updateError);
    }

    return { token: public_token };
  }

  async setProposalStatus(input: SetProposalStatusInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: existing, error: fetchError } = await this.db
      .from('proposals')
      .select('status')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .single();
    if (fetchError) this.throwErr(fetchError);

    const oldStatus = existing?.status;
    if (!['sent', 'read'].includes(oldStatus ?? '')) {
      throw new Error('Only sent or read proposals can be marked approved or declined');
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { status: input.status };
    if (input.status === 'approved') {
      payload.approved_at = now;
      payload.declined_at = null;
    } else {
      payload.declined_at = now;
      payload.approved_at = null;
    }

    const { data, error } = await this.db
      .from('proposals')
      .update(payload)
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      proposalId: input.proposalId,
      eventType: input.status,
      payload: { old_status: oldStatus, source: 'manual' },
      actorId: user.id,
    });

    if (input.status === 'approved') {
      const { handleProposalApproved } = await import('./proposal-v2.server');
      await handleProposalApproved(input.proposalId);
    }

    return data;
  }

  async addProposalComment(input: AddProposalCommentInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data: proposal, error: proposalError } = await this.db
      .from('proposals')
      .select('id')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .single();
    if (proposalError || !proposal) this.throwErr(proposalError, 'Proposal not found');

    const authorName =
      [user.user_metadata?.first_name, user.user_metadata?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || user.email || 'Team member';

    const { data: comment, error } = await this.db
      .from('proposal_comments')
      .insert({
        account_id: input.accountId,
        proposal_id: input.proposalId,
        author_id: user.id,
        author_name: authorName,
        body: input.body,
      })
      .select()
      .single();
    if (error) this.throwErr(error);

    await this.logEvent({
      accountId: input.accountId,
      proposalId: input.proposalId,
      eventType: 'comment_added',
      payload: { comment_id: comment.id, source: 'admin' },
      actorId: user.id,
    });

    return comment;
  }
}
