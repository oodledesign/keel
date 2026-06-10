import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { generateContractDraft } from '~/lib/ai/contract-generate';

export async function createDraftContractForProposal(proposalId: string) {
  const admin = getSupabaseServerAdminClient() as any;

  const { data: proposal } = await admin
    .from('proposals')
    .select(
      'id, account_id, client_id, deal_id, title, content_html, total_pence, currency, contract_id, recipient_name, recipient_email',
    )
    .eq('id', proposalId)
    .maybeSingle();

  if (!proposal || proposal.contract_id) return null;

  const [{ data: account }, { data: client }, { data: deal }] = await Promise.all([
    admin.from('accounts').select('name').eq('id', proposal.account_id).maybeSingle(),
    proposal.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', proposal.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    proposal.deal_id
      ? admin
          .from('pipeline_deals')
          .select('contact_name, company_name, value')
          .eq('id', proposal.deal_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipientName =
    proposal.recipient_name?.trim() ||
    client?.display_name?.trim() ||
    deal?.contact_name?.trim() ||
    'Client';
  const recipientCompany =
    client?.company_name?.trim() || deal?.company_name?.trim() || null;
  const dealValue =
    deal?.value != null ? Number(deal.value) : proposal.total_pence != null ? proposal.total_pence / 100 : null;

  let draft;
  try {
    draft = await generateContractDraft({
      accountName: account?.name ?? 'Workspace',
      senderName: account?.name ?? 'Provider',
      recipientName,
      recipientCompany,
      proposalHtml: proposal.content_html ?? '',
      dealValue,
    });
  } catch (error) {
    console.error('[proposals] contract draft generation failed', error);
    draft = {
      content_html: `<h2>Services Agreement</h2><p>Agreement relating to: ${proposal.title}</p><p>Please review and complete the terms based on the approved proposal.</p>`,
      payment_plan: [{ label: 'Full payment', percent: 100 }],
      total_pence: proposal.total_pence ?? 0,
    };
  }

  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .insert({
      account_id: proposal.account_id,
      client_id: proposal.client_id,
      deal_id: proposal.deal_id,
      proposal_id: proposal.id,
      title: `${proposal.title} — Agreement`,
      content_html: draft.content_html,
      status: 'draft',
      total_pence: draft.total_pence || proposal.total_pence || 0,
      currency: proposal.currency ?? 'gbp',
      payment_plan: draft.payment_plan,
      auto_send_on_approval: false,
      recipient_name: recipientName,
      recipient_email: proposal.recipient_email ?? client?.email ?? null,
    })
    .select('id')
    .single();

  if (contractError || !contract) {
    console.error('[proposals] failed to save draft contract', contractError);
    return null;
  }

  await admin
    .from('proposals')
    .update({ contract_id: contract.id })
    .eq('id', proposal.id);

  if (proposal.deal_id) {
    await admin
      .from('pipeline_deals')
      .update({ stage: 'proposal_sent' })
      .eq('id', proposal.deal_id);
  }

  await admin.from('contract_events').insert({
    account_id: proposal.account_id,
    contract_id: contract.id,
    event_type: 'created_from_proposal',
    payload: { proposal_id: proposal.id },
  });

  return contract.id;
}

export async function maybeAutoSendContractAfterApproval(proposalId: string) {
  const admin = getSupabaseServerAdminClient() as any;
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, account_id, contract_id, recipient_email, sent_to_email')
    .eq('id', proposalId)
    .maybeSingle();
  if (!proposal?.contract_id) return;

  const { data: contract } = await admin
    .from('contracts')
    .select('id, account_id, status, auto_send_on_approval, author_signed_at, recipient_email, sent_to_email')
    .eq('id', proposal.contract_id)
    .maybeSingle();

  if (
    !contract ||
    !contract.auto_send_on_approval ||
    !contract.author_signed_at ||
    contract.status === 'sent' ||
    contract.status === 'signed'
  ) {
    return;
  }

  const email =
    contract.recipient_email ??
    contract.sent_to_email ??
    proposal.recipient_email ??
    proposal.sent_to_email;
  if (!email) return;

  const { createContractsService } = await import(
    '../../../contracts/_lib/server/contracts.service'
  );
  const service = createContractsService(admin);
  try {
    await service.sendContract({
      accountId: proposal.account_id,
      contractId: contract.id,
      sent_to_email: email,
    });
  } catch (error) {
    console.error('[proposals] auto-send contract failed', error);
  }
}
