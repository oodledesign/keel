import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createInvoicesService } from '~/home/[account]/invoices/_lib/server/invoices.service';

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export type CreateCreditTopupInvoiceResult = {
  invoiceId: string;
  publicToken: string | null;
  units: number;
  totalPence: number;
};

/**
 * Create a one-off credit top-up invoice for a client.
 * On payment, maybeGrantCreditsOnInvoicePaid grants `units` as topup_purchase
 * (default expiry 6 months).
 *
 * Pass `asSystem: true` when the caller is not a workspace member (e.g. portal
 * contact after membership check) — uses system invoice APIs + admin token.
 */
export async function createCreditTopupInvoice(input: {
  accountId: string;
  clientId: string;
  units: number;
  /** Pence charged for the top-up pack. */
  totalPence: number;
  currency?: string;
  expiryMonths?: number;
  description?: string;
  autoSend?: boolean;
  sendToEmail?: string | null;
  asSystem?: boolean;
}): Promise<CreateCreditTopupInvoiceResult> {
  const units = Math.floor(input.units);
  if (units <= 0) throw new Error('units must be positive');
  if (input.totalPence < 0) throw new Error('totalPence must be >= 0');

  const expiryMonths =
    typeof input.expiryMonths === 'number' && input.expiryMonths > 0
      ? Math.floor(input.expiryMonths)
      : 6;

  const asSystem = Boolean(input.asSystem);
  const client = asSystem
    ? getSupabaseServerAdminClient()
    : getSupabaseServerClient();
  const service = createInvoicesService(client as never);

  const description = input.description?.trim() || `${units} credit top-up`;
  const currency = input.currency as
    | 'gbp'
    | 'usd'
    | 'eur'
    | 'aud'
    | 'cad'
    | 'nzd'
    | 'chf'
    | undefined;

  const invoice = asSystem
    ? await service.createInvoiceAsSystem({
        accountId: input.accountId,
        client_id: input.clientId,
        currency,
        notes: description,
        title: description,
      })
    : await service.createInvoice({
        accountId: input.accountId,
        client_id: input.clientId,
        currency,
        notes: description,
        title: description,
      });

  const itemPayload = {
    accountId: input.accountId,
    invoiceId: invoice.id,
    items: [
      {
        sort_order: 0,
        description,
        quantity: 1,
        unit_price_pence: input.totalPence,
        total_pence: input.totalPence,
        line_type: 'quantity' as const,
      },
    ],
  };

  if (asSystem) {
    await service.upsertInvoiceItemsAsSystem(itemPayload);
  } else {
    await service.upsertInvoiceItems(itemPayload);
  }

  const admin = adminDb();
  await admin
    .from('invoices')
    .update({
      metadata: {
        credit_topup_units: units,
        credit_grant_source: 'topup_purchase',
        credit_topup_expiry_months: expiryMonths,
      },
      status: 'sent',
    })
    .eq('id', invoice.id)
    .eq('account_id', input.accountId);

  let publicToken: string | null = null;
  if (asSystem) {
    const { randomBytes } = await import('crypto');
    const token = randomBytes(32).toString('hex');
    const { data: existing } = await admin
      .from('invoices')
      .select('public_token')
      .eq('id', invoice.id)
      .eq('account_id', input.accountId)
      .maybeSingle();
    publicToken =
      (existing as { public_token?: string | null } | null)?.public_token ??
      token;
    if (!(existing as { public_token?: string | null } | null)?.public_token) {
      await admin
        .from('invoices')
        .update({ public_token: publicToken })
        .eq('id', invoice.id)
        .eq('account_id', input.accountId);
    }
  } else {
    const { token } = await service.getInvoicePortalLink({
      accountId: input.accountId,
      invoiceId: invoice.id,
    });
    publicToken = token;
  }

  if (input.autoSend && input.sendToEmail?.trim()) {
    if (asSystem) {
      await service.sendInvoiceAsSystem({
        accountId: input.accountId,
        invoiceId: invoice.id,
        sent_to_email: input.sendToEmail.trim(),
      });
    } else {
      await service.sendInvoice({
        accountId: input.accountId,
        invoiceId: invoice.id,
        sent_to_email: input.sendToEmail.trim(),
      });
    }
  }

  return {
    invoiceId: invoice.id as string,
    publicToken,
    units,
    totalPence: input.totalPence,
  };
}
