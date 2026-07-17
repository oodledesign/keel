import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { computeInvoiceTotals } from '../invoice-totals';
import type { InvoiceForPdf } from './invoice-pdf';
import { loadPaymentSettingsForPortal } from './invoice-payment-settings.service';

export type InvoicePdfDisplayOptions = {
  show_reference?: boolean;
  show_due_date?: boolean;
  show_issued_date?: boolean;
  show_notes?: boolean;
  show_footer?: boolean;
  show_logo?: boolean;
  show_payment_link?: boolean;
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

export function truthyPdfParam(value: string | null, fallback = true) {
  if (value == null) return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
}

export function displayOptionsFromSearchParams(
  searchParams: URLSearchParams,
): InvoicePdfDisplayOptions {
  return {
    show_reference: truthyPdfParam(searchParams.get('showReference')),
    show_due_date: truthyPdfParam(searchParams.get('showDueDate')),
    show_issued_date: truthyPdfParam(searchParams.get('showIssuedDate')),
    show_notes: truthyPdfParam(searchParams.get('showNotes')),
    show_footer: truthyPdfParam(searchParams.get('showFooter')),
    show_logo: truthyPdfParam(searchParams.get('showLogo')),
    show_payment_link: truthyPdfParam(searchParams.get('showPaymentLink')),
  };
}

async function ensurePublicToken(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  invoice: { id: string; account_id: string; public_token?: string | null },
) {
  if (invoice.public_token) return invoice.public_token;
  const { randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  const { error } = await admin
    .from('invoices')
    .update({ public_token: token })
    .eq('id', invoice.id)
    .eq('account_id', invoice.account_id);
  if (error) return null;
  return token;
}

export async function buildInvoicePdfPayload(
  invoice: Record<string, unknown>,
  accountId: string,
  options: InvoicePdfDisplayOptions = {},
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
): Promise<InvoiceForPdf> {
  const client = getSupabaseServerAdminClient();
  const [{ data: items }, { data: clientRow }, { data: account }, brand] =
    await Promise.all([
      client
        .from('invoice_items')
        .select('description, quantity, unit_price_pence, total_pence')
        .eq('invoice_id', invoice.id as string)
        .order('sort_order', { ascending: true }),
      invoice.client_id
        ? client
            .from('clients')
            .select(
              'display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
            )
            .eq('id', invoice.client_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      client.from('accounts').select('name, email').eq('id', accountId).maybeSingle(),
      loadAccountBrandResolved(accountId).catch(() => null),
    ]);

  const totals = computeInvoiceTotals({
    subtotal_pence: (invoice.subtotal_pence as number) ?? 0,
    discount_type: invoice.discount_type as 'percent' | 'fixed' | null,
    discount_value: invoice.discount_value as number | null,
    tax_rate_bp: invoice.tax_rate_bp as number | null,
    late_fee_type: invoice.late_fee_type as 'percent' | 'fixed' | null,
    late_fee_value: invoice.late_fee_value as number | null,
    deposit_type: invoice.deposit_type as 'percent' | 'fixed' | null,
    deposit_value: invoice.deposit_value as number | null,
    due_at: invoice.due_at as string | null,
    status: invoice.status as string,
  });

  const paymentSettings = await loadPaymentSettingsForPortal(accountId);
  const token = await ensurePublicToken(client, {
    id: invoice.id as string,
    account_id: accountId,
    public_token: invoice.public_token as string | null,
  });
  const baseUrl = siteUrl();
  const paymentUrl = token
    ? `${baseUrl}/portal/invoices/${encodeURIComponent(token)}`
    : null;

  const senderName = [sender?.first_name, sender?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    invoice_number: invoice.invoice_number as string,
    status: invoice.status as string,
    due_at: invoice.due_at as string | null,
    issued_at: (invoice.issued_at as string | null) ?? null,
    title: (invoice.title as string | null) ?? null,
    reference_number: (invoice.reference_number as string | null) ?? null,
    total_pence: totals.total_pence,
    subtotal_pence: totals.subtotal_pence,
    discount_pence: totals.discount_pence,
    tax_pence: totals.tax_pence,
    late_fee_pence: totals.late_fee_pence,
    deposit_due_pence: totals.deposit_due_pence,
    currency: (invoice.currency as string) ?? 'gbp',
    notes: invoice.notes as string | null,
    footer_message: invoice.footer_message as string | null,
    brand_name: account?.name ?? null,
    logo_url: brand?.logo_url ?? null,
    payment_url: paymentUrl,
    sender_name: senderName || null,
    sender_email: sender?.email?.trim() || account?.email?.trim() || null,
    show_reference: options.show_reference ?? true,
    show_due_date: options.show_due_date ?? true,
    show_issued_date: options.show_issued_date ?? true,
    show_notes: options.show_notes ?? true,
    show_footer: options.show_footer ?? true,
    show_logo: options.show_logo ?? true,
    show_payment_link: options.show_payment_link ?? true,
    items: items ?? [],
    client: clientRow ?? null,
    bank: paymentSettings?.bank_transfer_enabled
      ? {
          bank_account_name: paymentSettings.bank_account_name,
          bank_sort_code: paymentSettings.bank_sort_code,
          bank_account_number: paymentSettings.bank_account_number,
          bank_iban: paymentSettings.bank_iban,
          bank_bic: paymentSettings.bank_bic,
          bank_transfer_instructions:
            paymentSettings.bank_transfer_instructions,
        }
      : null,
  };
}
