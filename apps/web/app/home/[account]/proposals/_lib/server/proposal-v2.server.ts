import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DEFAULT_PROPOSAL_EMAIL_BODY,
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
  DEFAULT_PROPOSAL_EMAIL_SUBJECT,
} from '../doc-smart-fields';
import {
  sendProposalApprovedOwnerNotification,
  sendProposalCommentOwnerNotification,
  sendProposalIssuedEmail,
} from './proposal-notifications';
import { createProposalsService } from './proposals.service';

function db() {
  return getSupabaseServerClient() as any;
}

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export async function getProposalTabCounts(accountId: string) {
  const client = db();
  const { data, error } = await client
    .from('proposals')
    .select('status')
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);

  let unapproved = 0;
  let pending = 0;
  for (const row of data ?? []) {
    if (row.status === 'draft') unapproved += 1;
    if (['sent', 'read'].includes(row.status)) pending += 1;
  }

  return {
    unapproved,
    pending,
    all: data?.length ?? 0,
  };
}

export async function duplicateProposal(accountId: string, proposalId: string) {
  const service = createProposalsService(getSupabaseServerClient());
  const source = await service.getProposal({ accountId, proposalId });
  if (!source) throw new Error('Proposal not found');

  const created = await service.createProposal({
    accountId,
    client_id: source.client_id,
    deal_id: source.deal_id,
    title: source.title,
    content_html: source.content_html,
    recipient_name: source.recipient_name,
    recipient_email: source.recipient_email,
    total_pence: source.total_pence,
    currency: source.currency,
    expires_at: source.expires_at,
    private_note: source.private_note,
  });

  await db()
    .from('proposals')
    .update({
      email_subject: source.email_subject,
      email_body: source.email_body,
      email_signature: source.email_signature,
    })
    .eq('id', created.id);

  return created;
}

/**
 * Proposals table has no archived_at column yet; retained for API parity with invoices.
 * No-op until a migration adds archive support.
 */
export async function archiveProposal(
  accountId: string,
  proposalId: string,
  _archived: boolean,
) {
  const { data, error } = await db()
    .from('proposals')
    .select('id')
    .eq('account_id', accountId)
    .eq('id', proposalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Proposal not found');
}

export async function resendProposal(accountId: string, proposalId: string) {
  const proposal = await db()
    .from('proposals')
    .select('id, status, sent_to_email, public_token')
    .eq('account_id', accountId)
    .eq('id', proposalId)
    .single();
  if (proposal.error || !proposal.data) throw new Error('Proposal not found');
  if (!['sent', 'read'].includes(proposal.data.status)) {
    throw new Error('Only sent proposals can be resent');
  }
  const email = proposal.data.sent_to_email;
  if (!email) throw new Error('No recipient email on file');
  if (!proposal.data.public_token) throw new Error('Proposal has no portal token');

  await sendProposalIssuedEmail({
    accountId,
    proposalId,
    recipientEmail: email,
  });
}

export async function markProposalReadByToken(token: string) {
  const admin = adminDb();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, status, read_at')
    .eq('public_token', token)
    .maybeSingle();
  if (!proposal || proposal.status !== 'sent' || proposal.read_at) return;

  const now = new Date().toISOString();
  await admin
    .from('proposals')
    .update({
      status: 'read',
      read_at: now,
    })
    .eq('id', proposal.id);

  await admin.from('proposal_events').insert({
    account_id: proposal.account_id,
    proposal_id: proposal.id,
    event_type: 'read',
    payload: { source: 'portal' },
  });
}

export async function addProposalCommentByToken(input: {
  token: string;
  author_name: string;
  body: string;
}) {
  const admin = adminDb();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, status')
    .eq('public_token', input.token)
    .maybeSingle();
  if (!proposal) throw new Error('Proposal not found');
  if (!['sent', 'read'].includes(proposal.status)) {
    throw new Error('Comments can only be added to active proposals');
  }

  const { data: comment, error } = await admin
    .from('proposal_comments')
    .insert({
      account_id: proposal.account_id,
      proposal_id: proposal.id,
      author_id: null,
      author_name: input.author_name.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from('proposal_events').insert({
    account_id: proposal.account_id,
    proposal_id: proposal.id,
    event_type: 'comment_added',
    payload: { comment_id: comment.id, source: 'portal' },
  });

  try {
    await sendProposalCommentOwnerNotification({
      accountId: proposal.account_id,
      proposalId: proposal.id,
      authorName: input.author_name,
      body: input.body,
    });
  } catch {
    // Non-blocking email failure.
  }

  return comment;
}

export async function approveProposalByToken(input: {
  token: string;
  recipient_name?: string | null;
}) {
  const admin = adminDb();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, status, recipient_name')
    .eq('public_token', input.token)
    .maybeSingle();
  if (!proposal) throw new Error('Proposal not found');
  if (!['sent', 'read'].includes(proposal.status)) {
    throw new Error('This proposal can no longer be approved');
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: 'approved',
    approved_at: now,
    declined_at: null,
  };
  if (input.recipient_name?.trim()) {
    patch.recipient_name = input.recipient_name.trim();
  }

  const { data: updated, error } = await admin
    .from('proposals')
    .update(patch)
    .eq('id', proposal.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from('proposal_events').insert({
    account_id: proposal.account_id,
    proposal_id: proposal.id,
    event_type: 'approved',
    payload: { source: 'portal' },
  });

  await handleProposalApproved(proposal.id);

  const { maybeAutoSendContractAfterApproval } = await import('./proposal-automation');
  await maybeAutoSendContractAfterApproval(proposal.id);

  try {
    await sendProposalApprovedOwnerNotification({
      accountId: proposal.account_id,
      proposalId: proposal.id,
      recipientName: input.recipient_name ?? updated.recipient_name,
    });
  } catch {
    // Non-blocking email failure.
  }

  return updated;
}

export async function declineProposalByToken(input: {
  token: string;
  reason?: string | null;
}) {
  const admin = adminDb();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, status')
    .eq('public_token', input.token)
    .maybeSingle();
  if (!proposal) throw new Error('Proposal not found');
  if (!['sent', 'read'].includes(proposal.status)) {
    throw new Error('This proposal can no longer be declined');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('proposals')
    .update({
      status: 'declined',
      declined_at: now,
      approved_at: null,
    })
    .eq('id', proposal.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from('proposal_events').insert({
    account_id: proposal.account_id,
    proposal_id: proposal.id,
    event_type: 'declined',
    payload: {
      source: 'portal',
      reason: input.reason?.trim() || null,
    },
  });

  return updated;
}

/**
 * When a deal-backed proposal is approved, create a client from the deal and link it.
 */
export async function convertDealToClient(
  accountId: string,
  dealId: string,
): Promise<{ clientId: string } | null> {
  const admin = adminDb();
  const { data: deal, error: dealError } = await admin
    .from('pipeline_deals')
    .select('contact_name, company_name, name')
    .eq('id', dealId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (dealError || !deal) return null;

  const contactName =
    deal.contact_name?.trim() ||
    deal.company_name?.trim() ||
    deal.name?.trim() ||
    'Client';
  const nameParts = contactName.split(/\s+/);
  const first_name = nameParts[0] ?? contactName;
  const last_name = nameParts.slice(1).join(' ') || null;

  const { data: client, error: clientError } = await admin
    .from('clients')
    .insert({
      account_id: accountId,
      display_name: contactName,
      first_name,
      last_name,
      company_name: deal.company_name?.trim() || null,
    })
    .select('id')
    .single();
  if (clientError || !client) {
    console.error('convertDealToClient failed', clientError);
    return null;
  }

  return { clientId: client.id };
}

export async function handleProposalApproved(proposalId: string) {
  const admin = adminDb();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, client_id, deal_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (!proposal || proposal.client_id || !proposal.deal_id) {
    return;
  }

  const converted = await convertDealToClient(proposal.account_id, proposal.deal_id);
  if (!converted?.clientId) return;

  await admin
    .from('proposals')
    .update({ client_id: converted.clientId })
    .eq('id', proposalId);

  if (proposal.deal_id) {
    await admin
      .from('pipeline_deals')
      .update({ stage: 'won' })
      .eq('id', proposal.deal_id);

    await admin
      .from('contracts')
      .update({ client_id: converted.clientId, deal_id: null })
      .eq('proposal_id', proposalId);
  }

  await admin.from('proposal_events').insert({
    account_id: proposal.account_id,
    proposal_id: proposalId,
    event_type: 'deal_converted',
    payload: {
      deal_id: proposal.deal_id,
      client_id: converted.clientId,
    },
  });
}

export {
  DEFAULT_PROPOSAL_EMAIL_BODY,
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
  DEFAULT_PROPOSAL_EMAIL_SUBJECT,
};
