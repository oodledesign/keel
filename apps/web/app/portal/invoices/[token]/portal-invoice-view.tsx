'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Building2, CreditCard, Download, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { formatInvoiceMoney } from '~/home/[account]/invoices/_lib/invoice-currency';
import type { AccountPaymentSettings } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';

type InvoicePayload = {
  id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  total_pence: number;
  subtotal_pence?: number;
  discount_pence?: number;
  tax_pence?: number;
  late_fee_pence?: number;
  deposit_due_pence?: number;
  amount_paid_pence?: number;
  currency: string;
  notes: string | null;
  footer_message?: string | null;
  issued_at: string | null;
  paid_at: string | null;
  items: Array<{
    description: string;
    description_detail?: string | null;
    quantity: number;
    unit_price_pence: number;
    total_pence: number;
  }>;
  client: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function PortalInvoiceView({
  invoice,
  token,
  paymentSettings,
}: {
  invoice: Record<string, unknown>;
  token: string;
  paymentSettings?: AccountPaymentSettings | null;
}) {
  const data = invoice as unknown as InvoicePayload;
  const [paying, setPaying] = useState<'full' | 'deposit' | null>(null);

  const clientName =
    (data.client?.display_name ??
      [data.client?.first_name, data.client?.last_name]
        .filter(Boolean)
        .join(' ')) ||
    '—';

  const amountPaid = data.amount_paid_pence ?? 0;
  const remaining = Math.max(0, data.total_pence - amountPaid);
  const depositDue = data.deposit_due_pence ?? 0;
  const hasDeposit = depositDue > 0 && amountPaid < depositDue;
  const money = (pence: number) => formatInvoiceMoney(pence, data.currency);

  const isPayable = ['sent', 'read'].includes(data.status) && remaining > 0;
  const isPaid = data.status === 'paid';
  const isOverdue =
    ['sent', 'read'].includes(data.status) &&
    data.due_at &&
    new Date(data.due_at) < new Date(new Date().toDateString());
  const displayStatus = isOverdue ? 'overdue' : data.status;

  const cardEnabled = Boolean(
    paymentSettings?.stripe_connect_enabled &&
    paymentSettings.stripe_account_id &&
    paymentSettings.stripe_pay_now_enabled,
  );
  const bankEnabled = Boolean(
    paymentSettings?.bank_transfer_enabled &&
    (paymentSettings.bank_account_number || paymentSettings.bank_iban),
  );

  const authSearch = new URLSearchParams({ next: `/portal/invoices/${token}` });
  if (data.client?.email) authSearch.set('email', data.client.email);

  const pdfUrl = `/api/invoices/pdf?token=${encodeURIComponent(token)}`;
  const checkoutUrl = (deposit?: boolean) =>
    `/api/invoices/checkout?token=${encodeURIComponent(token)}${deposit ? '&deposit=1' : ''}`;

  const statusClasses =
    displayStatus === 'paid'
      ? 'border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent)]/12 text-[#97D9AA]'
      : displayStatus === 'void' || displayStatus === 'cancelled'
        ? 'border-[#E85D75]/25 bg-[#E85D75]/12 text-[#F6A7B5]'
        : displayStatus === 'overdue'
          ? 'border-[#E85D75]/25 bg-[#E85D75]/12 text-[#F6A7B5]'
          : displayStatus === 'read'
            ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
            : displayStatus === 'sent'
              ? 'border-[#39AEB3]/25 bg-[#39AEB3]/12 text-[#B8D3D7]'
              : 'border-[color:var(--workspace-shell-border)] bg-white/6 text-[#D7DEEE]';

  const handlePay = (deposit: boolean) => {
    if (!isPayable || isPaid) return;
    setPaying(deposit ? 'deposit' : 'full');
    window.location.assign(checkoutUrl(deposit));
  };

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80 p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--workspace-shell-text)]">
              Invoice {data.invoice_number}
            </h1>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${statusClasses}`}
            >
              {displayStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {isPaid
              ? `Paid on ${formatDate(data.paid_at)}`
              : amountPaid > 0
                ? `${money(amountPaid)} paid · ${money(remaining)} remaining`
                : displayStatus === 'overdue'
                  ? 'Overdue'
                  : 'Awaiting payment'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={pdfUrl}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
          {isPayable && cardEnabled ? (
            <>
              {hasDeposit ? (
                <Button
                  size="sm"
                  onClick={() => handlePay(true)}
                  disabled={paying != null}
                >
                  {paying === 'deposit' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay deposit (
                  {money(Math.min(depositDue - amountPaid, remaining))})
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => handlePay(false)}
                disabled={paying != null}
                className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
              >
                {paying === 'full' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {hasDeposit ? 'Pay in full' : 'Pay now'}
              </Button>
            </>
          ) : null}
        </div>
        {isPayable && cardEnabled ? (
          <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
            Paying by card may incur a small processing fee.
          </p>
        ) : null}
      </div>

      {data.client ? (
        <div className="mt-8 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 p-4">
          <h2 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
            Bill to
          </h2>
          <p className="mt-1 font-medium text-[var(--workspace-shell-text)]">
            {clientName}
          </p>
          {data.client.company_name ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {data.client.company_name}
            </p>
          ) : null}
          {data.client.email ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {data.client.email}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-[var(--workspace-shell-text-muted)]">
            Due date
          </span>
          <p className="font-medium text-[var(--workspace-shell-text)]">
            {formatDate(data.due_at)}
          </p>
        </div>
        {data.issued_at ? (
          <div>
            <span className="text-[var(--workspace-shell-text-muted)]">
              Issued
            </span>
            <p className="font-medium text-[var(--workspace-shell-text)]">
              {formatDate(data.issued_at)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              <th className="pr-4 pb-3 font-medium">Description</th>
              <th className="w-24 pr-4 pb-3 text-right font-medium">Qty</th>
              <th className="w-32 pr-4 pb-3 text-right font-medium">
                Unit price
              </th>
              <th className="w-28 pr-4 pb-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.items ?? []).map((row, index) => (
              <tr
                key={index}
                className="border-b border-[color:var(--workspace-shell-border)]/70 text-[var(--workspace-shell-text-muted)]"
              >
                <td className="py-3 pr-4">
                  <div>{row.description}</div>
                  {row.description_detail ? (
                    <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {row.description_detail}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-right">{row.quantity}</td>
                <td className="py-3 pr-4 text-right">
                  {money(row.unit_price_pence)}
                </td>
                <td className="py-3 pr-4 text-right">
                  {money(row.total_pence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 border-t border-[color:var(--workspace-shell-border)] pt-4 text-sm text-[var(--workspace-shell-text-muted)]">
          {(data.discount_pence ?? 0) > 0 ? (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{money(data.discount_pence ?? 0)}</span>
            </div>
          ) : null}
          {(data.tax_pence ?? 0) > 0 ? (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{money(data.tax_pence ?? 0)}</span>
            </div>
          ) : null}
          {(data.late_fee_pence ?? 0) > 0 ? (
            <div className="flex justify-between text-amber-300">
              <span>Late fee</span>
              <span>{money(data.late_fee_pence ?? 0)}</span>
            </div>
          ) : null}
          <div className="flex justify-end pt-2">
            <p className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              Total {money(data.total_pence)}
            </p>
          </div>
          {hasDeposit ? (
            <div className="flex justify-between text-[#97D9AA]">
              <span>Deposit due</span>
              <span>{money(depositDue)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {bankEnabled && isPayable ? (
        <div className="mt-8 rounded-lg border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent)]/5 p-4">
          <div className="flex items-center gap-2 text-[#97D9AA]">
            <Building2 className="h-4 w-4" />
            <h3 className="font-medium">Pay by bank transfer</h3>
          </div>
          <div className="mt-3 space-y-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {paymentSettings?.bank_account_name ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Account name:
                </span>{' '}
                {paymentSettings.bank_account_name}
              </p>
            ) : null}
            {paymentSettings?.bank_sort_code ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Sort code:
                </span>{' '}
                {paymentSettings.bank_sort_code}
              </p>
            ) : null}
            {paymentSettings?.bank_account_number ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Account number:
                </span>{' '}
                {paymentSettings.bank_account_number}
              </p>
            ) : null}
            {paymentSettings?.bank_iban ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  IBAN:
                </span>{' '}
                {paymentSettings.bank_iban}
              </p>
            ) : null}
            {paymentSettings?.bank_bic ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  BIC:
                </span>{' '}
                {paymentSettings.bank_bic}
              </p>
            ) : null}
            <p>
              <span className="text-[var(--workspace-shell-text-muted)]">
                Reference:
              </span>{' '}
              {data.invoice_number}
            </p>
            {paymentSettings?.bank_transfer_instructions ? (
              <p className="mt-2 text-[var(--workspace-shell-text-muted)]">
                {paymentSettings.bank_transfer_instructions}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {(data.notes || data.footer_message) && (
        <div className="mt-6 space-y-2 rounded-md bg-[var(--workspace-control-surface)]/50 p-3 text-sm text-[var(--workspace-shell-text-muted)]">
          {data.notes ? <p>{data.notes}</p> : null}
          {data.footer_message ? <p>{data.footer_message}</p> : null}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#F7F9FC]">
              Want a client account for future invoices?
            </p>
            <p className="mt-1 text-sm text-[#AAB4C8]">
              Sign in to Ozer to see invoices, job details, and messages in one
              place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/auth/sign-in?${authSearch.toString()}`}>
                Client login
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[var(--ozer-accent)] text-[#09111F]"
            >
              <Link href={`/auth/sign-up?${authSearch.toString()}`}>
                Client sign up
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
