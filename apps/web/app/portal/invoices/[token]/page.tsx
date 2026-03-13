import { notFound } from 'next/navigation';

import Link from 'next/link';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { reconcileInvoicePaymentByCheckoutSession } from '~/home/[account]/invoices/_lib/server/invoice-checkout';

import { PortalInvoiceView } from './portal-invoice-view';

interface PortalInvoicePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; session_id?: string }>;
}

async function getInvoiceByToken(token: string) {
  const client = getSupabaseServerAdminClient();

  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .select(
      'id, invoice_number, status, due_at, total_pence, currency, notes, issued_at, paid_at, client_id',
    )
    .eq('public_token', token)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return null;
  }

  const [{ data: items }, { data: clientData }] = await Promise.all([
    client
      .from('invoice_items')
      .select('description, quantity, unit_price_pence, total_pence')
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

  return {
    ...invoice,
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

  let paymentReconciled = false;

  if (paid === '1' && session_id) {
    try {
      const result = await reconcileInvoicePaymentByCheckoutSession(
        session_id,
        token,
      );
      paymentReconciled = result.paid;
    } catch {
      paymentReconciled = false;
    }
  }

  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();
  const invoiceStatus = String((invoice as { status?: string }).status ?? '');
  const isPaid = invoiceStatus === 'paid';
  const isCancelled = invoiceStatus === 'cancelled';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to home
        </Link>
      </div>
      {paid === '1' && isPaid && (
        <div className="mb-6 rounded-lg border border-emerald-700 bg-emerald-500/10 px-4 py-3 text-emerald-400">
          Payment successful. Thank you.
        </div>
      )}
      {paid === '1' && !isPaid && (
        <div className="mb-6 rounded-lg border border-amber-600/60 bg-amber-500/10 px-4 py-3 text-amber-300">
          {paymentReconciled
            ? 'Payment was received and is still syncing.'
            : 'Payment return detected, but the invoice has not been marked paid yet.'}
        </div>
      )}
      {cancelled === '1' && (
        <div className="mb-6 rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-3 text-zinc-400">
          Payment was cancelled.
        </div>
      )}
      {isCancelled && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          This invoice is cancelled and can no longer be paid.
        </div>
      )}
      <PortalInvoiceView invoice={invoice} token={token} />
    </div>
  );
}
