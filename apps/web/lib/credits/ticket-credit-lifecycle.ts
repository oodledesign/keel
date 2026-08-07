import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  consumeClientCredits,
  refundClientCredits,
} from '~/lib/credits/client-credit-ledger';

type RequestTypeRow = {
  id: string;
  credit_cost: number | null;
  is_billable: boolean | null;
  is_active: boolean | null;
  account_id: string;
};

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export async function resolveRequestTypeCreditSnapshot(input: {
  accountId: string;
  requestTypeId: string | null | undefined;
}): Promise<{
  requestTypeId: string | null;
  creditCostSnapshot: number | null;
  isBillable: boolean;
}> {
  if (!input.requestTypeId) {
    return {
      requestTypeId: null,
      creditCostSnapshot: null,
      isBillable: false,
    };
  }

  const { data, error } = await adminDb()
    .from('request_types')
    .select('id, credit_cost, is_billable, is_active, account_id')
    .eq('id', input.requestTypeId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Request type not found');
  }

  const row = data as RequestTypeRow;
  if (row.is_active === false) {
    throw new Error('Request type is inactive');
  }

  const isBillable = row.is_billable !== false;
  const cost = Math.max(0, Math.floor(Number(row.credit_cost ?? 0)));

  return {
    requestTypeId: row.id,
    creditCostSnapshot: isBillable ? cost : 0,
    isBillable,
  };
}

/**
 * Attempt credit consume when work starts (in-progress).
 * Returns insufficient so caller can force pending_credits.
 */
export async function tryConsumeCreditsForTicketWorkStart(input: {
  accountId: string;
  ticketId: string;
  actorId?: string | null;
}): Promise<
  | { ok: true; consumed: number }
  | {
      ok: false;
      error: 'insufficient_balance';
      available: number;
      requested: number;
    }
  | { ok: true; consumed: 0; skipped: true }
> {
  const admin = adminDb();
  const { data: ticket, error } = await admin
    .from('support_tickets')
    .select(
      'id, account_id, client_org_id, credit_cost_snapshot, credits_deducted_at, status',
    )
    .eq('id', input.ticketId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error || !ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.credits_deducted_at) {
    return { ok: true, consumed: 0, skipped: true };
  }

  const cost = Math.floor(Number(ticket.credit_cost_snapshot ?? 0));
  if (!cost || cost <= 0) {
    return { ok: true, consumed: 0, skipped: true };
  }

  if (!ticket.client_org_id) {
    throw new Error(
      'This ticket needs a client organisation before credits can be deducted',
    );
  }

  const result = await consumeClientCredits({
    clientOrgId: ticket.client_org_id,
    amount: cost,
    relatedTicketId: ticket.id,
    actorId: input.actorId ?? null,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: 'insufficient_balance',
      available: result.available ?? 0,
      requested: result.requested ?? cost,
    };
  }

  await admin
    .from('support_tickets')
    .update({ credits_deducted_at: new Date().toISOString() })
    .eq('id', ticket.id)
    .eq('account_id', input.accountId);

  return { ok: true, consumed: result.consumed ?? cost };
}

export async function refundCreditsIfTicketCancelled(input: {
  accountId: string;
  ticketId: string;
  previousStatus: string;
  actorId?: string | null;
}): Promise<void> {
  // Keep charged credits when closing after a completed (resolved) ticket.
  if (input.previousStatus === 'resolved') return;

  const admin = adminDb();
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, credits_deducted_at')
    .eq('id', input.ticketId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (!ticket?.credits_deducted_at) return;

  await refundClientCredits({
    relatedTicketId: input.ticketId,
    actorId: input.actorId ?? null,
    reason: 'ticket_cancelled',
  });
}
