import { NextResponse } from 'next/server';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { computeInvoiceTotals } from '~/home/[account]/invoices/_lib/invoice-totals';
import { buildInvoicePdf } from '~/home/[account]/invoices/_lib/server/invoice-pdf';
import { loadPaymentSettingsForPortal } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

function truthyParam(value: string | null, fallback = true) {
  if (value == null) return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
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

async function buildPayload(
  invoice: Record<string, unknown>,
  accountId: string,
  options: {
    show_reference?: boolean;
    show_due_date?: boolean;
    show_issued_date?: boolean;
    show_notes?: boolean;
    show_footer?: boolean;
    show_logo?: boolean;
    show_payment_link?: boolean;
  } = {},
) {
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
      client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
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

function displayOptionsFromSearch(searchParams: URLSearchParams) {
  return {
    show_reference: truthyParam(searchParams.get('showReference')),
    show_due_date: truthyParam(searchParams.get('showDueDate')),
    show_issued_date: truthyParam(searchParams.get('showIssuedDate')),
    show_notes: truthyParam(searchParams.get('showNotes')),
    show_footer: truthyParam(searchParams.get('showFooter')),
    show_logo: truthyParam(searchParams.get('showLogo')),
    show_payment_link: truthyParam(searchParams.get('showPaymentLink')),
  };
}

/**
 * GET /api/invoices/pdf?token=xxx  — Portal: load by public token, no auth. Returns PDF.
 * GET /api/invoices/pdf?invoiceId=xxx — Dashboard: auth required, RLS applies. Returns PDF.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const invoiceId = searchParams.get('invoiceId');
  const options = displayOptionsFromSearch(searchParams);

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: invoice, error: invoiceError } = await client
      .from('invoices')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payload = await buildPayload(invoice, invoice.account_id, options);
    const pdfBytes = await buildInvoicePdf(payload);
    const filename = `invoice-${invoice.invoice_number}.pdf`;
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  if (invoiceId) {
    const client = getSupabaseServerClient();
    const auth = await requireUser(client);

    if (!auth.data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: invoice, error: invError } = await client
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();
    if (invError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payload = await buildPayload(invoice, invoice.account_id, options);
    const pdfBytes = await buildInvoicePdf(payload);
    const filename = `invoice-${invoice.invoice_number}.pdf`;
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  return NextResponse.json(
    { error: 'Provide token or invoiceId' },
    { status: 400 },
  );
}
