import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

async function resolveClientIdForContract(contract: {
  client_id?: string | null;
  deal_id?: string | null;
}): Promise<string | null> {
  if (contract.client_id) return contract.client_id;
  if (!contract.deal_id) return null;

  const admin = adminDb();
  const { data: deal } = await admin
    .from('pipeline_deals')
    .select('client_id')
    .eq('id', contract.deal_id)
    .maybeSingle();

  return deal?.client_id ?? null;
}

export async function markContractReadByToken(token: string) {
  const admin = adminDb();
  const { data: contract } = await admin
    .from('contracts')
    .select('id, status, read_at')
    .eq('public_token', token)
    .maybeSingle();

  if (!contract || contract.status !== 'sent' || contract.read_at) {
    return;
  }

  await admin
    .from('contracts')
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('id', contract.id);
}

export async function signContractRecipientByToken(
  token: string,
  input: {
    recipient_type: 'individual' | 'company';
    recipient_name: string;
    recipient_company?: string | null;
    recipient_signature_type: 'typed' | 'drawn' | 'uploaded';
    recipient_signature_data: string;
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
  });
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

  if (!contract.author_signed_at || !contract.recipient_signed_at) {
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

  await admin.from('contract_events').insert({
    account_id: accountId,
    contract_id: contractId,
    event_type: 'signed',
    payload: {},
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

  const clientId = await resolveClientIdForContract(contract);
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
          quantity: 1,
          unit_price_pence: amountPence,
          total_pence: amountPence,
        },
      ],
    });

    createdInvoices.push(invoice);
  }

  await admin
    .from('contracts')
    .update({ invoices_generated_at: new Date().toISOString() })
    .eq('id', contractId);

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
    .select('status, author_signed_at, recipient_signed_at')
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);

  let draft = 0;
  let unsigned = 0;

  for (const row of data ?? []) {
    if (row.status === 'draft') draft += 1;
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
    all: data?.length ?? 0,
  };
}
