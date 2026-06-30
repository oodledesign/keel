import { notFound } from 'next/navigation';

import Link from 'next/link';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { computeInvoiceTotals } from '~/home/[account]/invoices/_lib/invoice-totals';
import { reconcileInvoicePaymentByCheckoutSession } from '~/home/[account]/invoices/_lib/server/invoice-checkout';
import { loadPaymentSettingsForPortal } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';
import { markInvoiceReadByToken } from '~/home/[account]/invoices/_lib/server/invoice-v2.server';

import { PortalInvoiceView } from './portal-invoice-view';

interface PortalInvoicePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; session_id?: string }>;
}

async function getInvoiceByToken(token: string) {
  const client = getSupabaseServerAdminClient();

  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return null;
  }

  const [{ data: items }, { data: clientData }] = await Promise.all([
    client
      .from('invoice_items')
      .select('description, description_detail, quantity, unit_price_pence, total_pence')
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
  ]);

  const totals = computeInvoiceTotals({
    subtotal_pence: invoice.subtotal_pence ?? 0,
    discount_type: invoice.discount_type,
    discount_value: invoice.discount_value,
    tax_rate_bp: invoice.tax_rate_bp,
    late_fee_type: invoice.late_fee_type,
    late_fee_value: invoice.late_fee_value,
    deposit_type: invoice.deposit_type,
    deposit_value: invoice.deposit_value,
    due_at: invoice.due_at,
    status: invoice.status,
  });

  return {
    ...invoice,
    ...totals,
    items: items ?? [],
    client: clientData ?? null,
  } as Record<string, unknown>;
}

export default async function PortalInvoicePage({
  params,
  searchParams,
}: PortalInvoicePageProps) {
  const { token } = await params;
  const { paid, cancelled, session_id } = await searchParams;
  if (!token) notFound();

  await markInvoiceReadByToken(token);

  let paymentReconciled = false;

  if (paid === '1' && session_id) {
    try {
      const result = await reconcileInvoicePaymentByCheckoutSession(session_id, token);
      paymentReconciled = result.paid;
    } catch {
      paymentReconciled = false;
    }
  }

  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  const accountId = String((invoice as { account_id?: string }).account_id ?? '');
  const paymentSettings = accountId ? await loadPaymentSettingsForPortal(accountId) : null;

  const invoiceStatus = String((invoice as { status?: string }).status ?? '');
  const isPaid = invoiceStatus === 'paid';
  const isVoid = ['cancelled', 'void'].includes(invoiceStatus);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]">
          ← Back to home
        </Link>
      </div>
      {paid === '1' && isPaid ? (
        <div className="mb-6 rounded-lg border border-emerald-700 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-[var(--ozer-accent-muted)]">
          Payment successful. Thank you.
        </div>
      ) : null}
      {paid === '1' && !isPaid ? (
        <div className="mb-6 rounded-lg border border-amber-600/60 bg-amber-500/10 px-4 py-3 text-amber-300">
          {paymentReconciled
            ? 'Payment was received and is still syncing.'
            : 'Payment return detected, but the invoice has not been marked paid yet.'}
        </div>
      ) : null}
      {cancelled === '1' ? (
        <div className="mb-6 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 px-4 py-3 text-[var(--workspace-shell-text-muted)]">
          Payment was cancelled.
        </div>
      ) : null}
      {isVoid ? (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          This invoice is no longer payable.
        </div>
      ) : null}
      <PortalInvoiceView
        invoice={invoice}
        token={token}
        paymentSettings={paymentSettings}
      />
    </div>
  );
}
