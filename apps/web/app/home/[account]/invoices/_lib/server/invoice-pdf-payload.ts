import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import type { Database } from '~/lib/database.types';

import { computeInvoiceTotals } from '../invoice-totals';
import { loadPaymentSettingsForPortal } from './invoice-payment-settings.service';
import type { InvoiceForPdf } from './invoice-pdf';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

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
  invoice: Pick<InvoiceRow, 'id' | 'account_id' | 'public_token'>,
) {
  if (invoice.public_token) return invoice.public_token;
  const { randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  const admin = getSupabaseServerAdminClient();
  const { error } = await admin
    .from('invoices')
    .update({ public_token: token })
    .eq('id', invoice.id)
    .eq('account_id', invoice.account_id);
  if (error) return null;
  return token;
}

export async function buildInvoicePdfPayload(
  invoice: InvoiceRow,
  accountId: string,
  options: InvoicePdfDisplayOptions = {},
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
): Promise<InvoiceForPdf> {
  const client = getSupabaseServerAdminClient();
  const invoiceProjectId = (
    invoice as InvoiceRow & { project_id?: string | null }
  ).project_id;
  const [
    { data: items },
    { data: clientRow },
    { data: account },
    { data: project },
    brand,
  ] = await Promise.all([
    client
      .from('invoice_items')
      .select('description, line_type, quantity, unit_price_pence, total_pence')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true }),
    invoice.client_id
      ? client
          .from('clients')
          .select(
            'display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', invoice.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from('accounts')
      .select('name, email')
      .eq('id', accountId)
      .maybeSingle(),
    invoiceProjectId
      ? client
          .from('projects')
          .select('name')
          .eq('id', invoiceProjectId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadAccountBrandResolved(accountId).catch(() => null),
  ]);

  const totals = computeInvoiceTotals({
    subtotal_pence: invoice.subtotal_pence ?? 0,
    discount_type: invoice.discount_type as 'percent' | 'fixed' | null,
    discount_value: invoice.discount_value,
    tax_rate_bp: invoice.tax_rate_bp,
    late_fee_type: invoice.late_fee_type as 'percent' | 'fixed' | null,
    late_fee_value: invoice.late_fee_value,
    deposit_type: invoice.deposit_type as 'percent' | 'fixed' | null,
    deposit_value: invoice.deposit_value,
    due_at: invoice.due_at,
    status: invoice.status,
  });

  const paymentSettings = await loadPaymentSettingsForPortal(accountId);
  const token = await ensurePublicToken({
    id: invoice.id,
    account_id: accountId,
    public_token: invoice.public_token,
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
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    due_at: invoice.due_at,
    issued_at: invoice.issued_at ?? null,
    title: invoice.title ?? null,
    reference_number: invoice.reference_number ?? null,
    project_name: project?.name?.trim() || null,
    total_pence: totals.total_pence,
    subtotal_pence: totals.subtotal_pence,
    discount_pence: totals.discount_pence,
    tax_pence: totals.tax_pence,
    late_fee_pence: totals.late_fee_pence,
    deposit_due_pence: totals.deposit_due_pence,
    currency: invoice.currency ?? 'gbp',
    notes: invoice.notes,
    footer_message: invoice.footer_message ?? null,
    brand_name: account?.name ?? null,
    logo_url: brand?.logo_url ?? null,
    payment_url: paymentUrl,
    sender_name: senderName || null,
    sender_email: sender?.email?.trim() || account?.email?.trim() || null,
    business_email:
      brand?.contact_email?.trim() || account?.email?.trim() || null,
    business_phone: brand?.phone?.trim() || null,
    business_website: brand?.website_url?.trim() || null,
    show_reference: options.show_reference ?? true,
    show_due_date: options.show_due_date ?? true,
    show_issued_date: options.show_issued_date ?? true,
    show_notes: options.show_notes ?? true,
    show_footer: options.show_footer ?? true,
    show_logo: options.show_logo ?? true,
    show_payment_link: options.show_payment_link ?? true,
    items: (items ?? []).map((item) => ({
      ...item,
      line_type:
        (item as { line_type?: string | null }).line_type ?? 'quantity',
      quantity: Number(item.quantity),
    })),
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
