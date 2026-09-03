import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { allSignersComplete } from '~/lib/contracts/signing-order';
import { checkContractTokenAccess } from '~/lib/contracts/token-access';
import { overlayContractVersion } from '~/lib/contracts/version-snapshot';

import { createInvoicesService } from '../../../invoices/_lib/server/invoices.service';
import type { PaymentPlanItem } from '../schema/contracts.schema';
import { createContractsService } from './contracts.service';

function db() {
  return getSupabaseServerClient() as any;
}

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

function parsePaymentPlan(raw: unknown): PaymentPlanItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PaymentPlanItem =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as PaymentPlanItem).label === 'string' &&
      typeof (item as PaymentPlanItem).percent === 'number',
  );
}

async function resolveClientIdForContract(
  contract: {
    client_id?: string | null;
    deal_id?: string | null;
  },
  accountId: string,
): Promise<string | null> {
  if (contract.client_id) return contract.client_id;
  if (!contract.deal_id) return null;

  const admin = adminDb();
  // Scope by account_id too: never resolve a client through a deal that
  // belongs to another workspace, even if contract.deal_id were somehow
  // mismatched.
  const { data: deal } = await admin
    .from('pipeline_deals')
    .select('client_id')
    .eq('id', contract.deal_id)
    .eq('account_id', accountId)
    .maybeSingle();

  return deal?.client_id ?? null;
}

export async function markContractReadByToken(token: string) {
  const admin = adminDb();
  const { data: contract } = await admin
    .from('contracts')
    .select(
      'id, account_id, status, read_at, public_token_revoked_at, public_token_expires_at',
    )
    .eq('public_token', token)
    .maybeSingle();

  if (
    !contract ||
    contract.status !== 'sent' ||
    contract.read_at ||
    !checkContractTokenAccess(contract).accessible
  ) {
    return;
  }

  await admin
    .from('contracts')
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('id', contract.id);

  // Audit trail for public-link access (item 2): first-view only, so a
  // page reload doesn't spam the timeline.
  await admin.from('contract_events').insert({
    account_id: contract.account_id,
    contract_id: contract.id,
    event_type: 'portal_viewed',
    payload: {},
    actor_id: null,
  });
}

export async function declineContractRecipientByToken(
  token: string,
  reason?: string | null,
) {
  const service = createContractsService(adminDb());
  const updated = await service.declineRecipient({
    token,
    reason: reason ?? null,
  });

  try {
    const { sendContractDeclinedNotification } =
      await import('./contract-notifications');
    await sendContractDeclinedNotification({
      accountId: updated.account_id,
      contractId: updated.id,
      reason: reason ?? null,
    });
  } catch {
    // Non-blocking: decline is already recorded even if the workspace
    // notification fails.
  }

  return updated;
}

export async function signContractRecipientByToken(
  token: string,
  input: {
    recipient_type: 'individual' | 'company';
    recipient_name: string;
    recipient_company?: string | null;
    recipient_signature_type: 'typed' | 'drawn' | 'uploaded';
    recipient_signature_data: string;
    version_id?: string;
    content_hash?: string;
    signer_id?: string;
  },
) {
  const service = createContractsService(adminDb());
  return service.signRecipient({
    token,
    recipient_type: input.recipient_type,
    recipient_name: input.recipient_name,
    recipient_company: input.recipient_company ?? null,
    recipient_signature_type: input.recipient_signature_type,
    recipient_signature_data: input.recipient_signature_data,
    version_id: input.version_id,
    content_hash: input.content_hash,
    signer_id: input.signer_id,
  });
}

export async function loadFrozenContractSnapshot(contract: Record<string, unknown>) {
  const admin = adminDb();
  const sentVersionId = (contract.sent_version_id as string | null) ?? null;
  if (!sentVersionId) {
    return { contract, version: null, signers: [] as Record<string, unknown>[] };
  }

  const { data: version } = await admin
    .from('contract_versions')
    .select('*')
    .eq('id', sentVersionId)
    .maybeSingle();
  const { data: signers } = await admin
    .from('contract_signers')
    .select(
      'id, signing_order, role, party_type, name, email, company, signature_type, signature_data, signed_at',
    )
    .eq('contract_id', contract.id)
    .eq('version_id', sentVersionId)
    .order('signing_order', { ascending: true });

  return {
    contract: overlayContractVersion(contract, version),
    version: version ?? null,
    signers: signers ?? [],
  };
}

export async function finalizeContractIfFullySigned(
  contractId: string,
  accountId: string,
) {
  const admin = adminDb();
  const { data: contract, error } = await admin
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('account_id', accountId)
    .single();
  if (error || !contract) return null;

  const { data: signers } = contract.sent_version_id
    ? await admin
        .from('contract_signers')
        .select('id, signing_order, role, name, signed_at')
        .eq('contract_id', contractId)
        .eq('version_id', contract.sent_version_id)
    : { data: [] as { signed_at?: string | null }[] };

  const rosterComplete =
    Array.isArray(signers) && signers.length > 0
      ? allSignersComplete(signers)
      : Boolean(contract.author_signed_at && contract.recipient_signed_at);

  if (!rosterComplete) {
    return contract;
  }

  if (contract.status === 'signed') {
    return contract;
  }

  const { data: updated, error: updateError } = await admin
    .from('contracts')
    .update({ status: 'signed' })
    .eq('id', contractId)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  if (contract.sent_version_id) {
    await admin
      .from('contract_versions')
      .update({ status: 'signed' })
      .eq('id', contract.sent_version_id)
      .eq('status', 'sent');
  }

  await admin.from('contract_events').insert({
    account_id: accountId,
    contract_id: contractId,
    event_type: 'signed',
    payload: {
      version_id: contract.sent_version_id ?? null,
      version_number: contract.current_version_number ?? null,
    },
    actor_id: null,
  });

  const paymentPlan = parsePaymentPlan(updated.payment_plan);
  if (paymentPlan.length > 0 && !updated.invoices_generated_at) {
    await generateInstalmentInvoices(contractId, accountId);
  }

  return updated;
}

export async function generateInstalmentInvoices(
  contractId: string,
  accountId: string,
) {
  const admin = adminDb();
  const { data: contract, error } = await admin
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('account_id', accountId)
    .single();
  if (error || !contract) throw new Error('Contract not found');

  if (contract.invoices_generated_at) {
    return [];
  }

  const paymentPlan = parsePaymentPlan(contract.payment_plan);
  if (paymentPlan.length === 0) {
    return [];
  }

  // Atomically claim the "not yet generated" slot before doing any work.
  // generateInstalmentInvoices can be reached from two places that race
  // each other in principle — the manual "Generate invoices" action and
  // the automatic post-signing finalize path — and the checks above are
  // only a snapshot. This conditional UPDATE is the actual idempotency
  // guard: only the caller that flips invoices_generated_at from NULL
  // wins and proceeds; everyone else backs off with no invoices created.
  const { data: claimed, error: claimError } = await admin
    .from('contracts')
    .update({ invoices_generated_at: new Date().toISOString() })
    .eq('id', contractId)
    .eq('account_id', accountId)
    .is('invoices_generated_at', null)
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    // Lost the race to a concurrent call, which will create the invoices.
    return [];
  }

  const clientId = await resolveClientIdForContract(contract, accountId);
  if (!clientId) {
    throw new Error('A client is required to generate instalment invoices');
  }

  const service = createInvoicesService(admin);
  const totalPence = contract.total_pence ?? 0;
  const title = contract.title?.trim() || 'Agreement';
  const totalParts = paymentPlan.length;
  const createdInvoices = [];

  for (let index = 0; index < paymentPlan.length; index += 1) {
    const item = paymentPlan[index]!;
    const instalmentNumber = index + 1;
    const lineDescription = `${title}: Instalment ${instalmentNumber}/${totalParts}`;
    const amountPence = Math.round((totalPence * item.percent) / 100);

    const invoice = await service.createInvoice({
      accountId,
      client_id: clientId,
      title: lineDescription,
      notes: `Generated from contract: ${title}`,
    });

    await admin
      .from('invoices')
      .update({ currency: contract.currency ?? 'gbp' })
      .eq('id', invoice.id);

    await service.upsertInvoiceItems({
      accountId,
      invoiceId: invoice.id,
      items: [
        {
          sort_order: 0,
          description: lineDescription,
          description_detail: `${item.percent}% of total`,
          line_type: 'quantity',
          quantity: 1,
          unit_price_pence: amountPence,
          total_pence: amountPence,
        },
      ],
    });

    createdInvoices.push(invoice);
  }

  // invoices_generated_at was already set atomically by the claim above.

  await admin.from('contract_events').insert({
    account_id: accountId,
    contract_id: contractId,
    event_type: 'invoices_generated',
    payload: {
      count: createdInvoices.length,
      invoice_ids: createdInvoices.map((row) => row.id),
    },
    actor_id: null,
  });

  return createdInvoices;
}

export async function getContractTabCounts(accountId: string) {
  const client = db();
  const { data, error } = await client
    .from('contracts')
    .select('status, author_signed_at, recipient_signed_at, archived_at')
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);

  let draft = 0;
  let unsigned = 0;
  let sent = 0;
  let signed = 0;
  let cancelled = 0;
  let archived = 0;
  let active = 0;

  for (const row of data ?? []) {
    if (row.archived_at) {
      archived += 1;
      continue;
    }
    active += 1;
    if (row.status === 'draft') draft += 1;
    if (row.status === 'sent') sent += 1;
    if (row.status === 'signed') signed += 1;
    if (row.status === 'cancelled') cancelled += 1;
    if (
      ['draft', 'ready_to_sign', 'sent'].includes(row.status) &&
      (!row.author_signed_at || !row.recipient_signed_at)
    ) {
      unsigned += 1;
    }
  }

  return {
    draft,
    unsigned,
    sent,
    signed,
    cancelled,
    archived,
    all: active,
  };
}
