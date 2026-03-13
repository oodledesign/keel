'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Download, Loader2, CreditCard } from 'lucide-react';

import { Button } from '@kit/ui/button';

type InvoicePayload = {
  id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  total_pence: number;
  currency: string;
  notes: string | null;
  issued_at: string | null;
  paid_at: string | null;
  items: Array<{
    description: string;
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

function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

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
}: {
  invoice: Record<string, unknown>;
  token: string;
}) {
  const data = invoice as unknown as InvoicePayload;
  const [paying, setPaying] = useState(false);

  const clientName =
    (data.client?.display_name ??
      [data.client?.first_name, data.client?.last_name]
        .filter(Boolean)
        .join(' ')) || '—';
  const isPayable =
    data.status === 'sent' && data.total_pence > 0;
  const isPaid = data.status === 'paid';
  const isOverdue =
    data.status === 'sent' &&
    data.due_at &&
    new Date(data.due_at) < new Date(new Date().toDateString());
  const displayStatus = isOverdue ? 'overdue' : data.status;
  const authSearch = new URLSearchParams({
    next: `/portal/invoices/${token}`,
  });

  if (data.client?.email) {
    authSearch.set('email', data.client.email);
  }

  const signInHref = `/auth/sign-in?${authSearch.toString()}`;
  const signUpHref = `/auth/sign-up?${authSearch.toString()}`;

  const pdfUrl = `/api/invoices/pdf?token=${encodeURIComponent(token)}`;
  const checkoutUrl = `/api/invoices/checkout?token=${encodeURIComponent(token)}`;

  const statusClasses =
    displayStatus === 'paid'
      ? 'border-[#57C87F]/25 bg-[#57C87F]/12 text-[#97D9AA]'
      : displayStatus === 'cancelled'
        ? 'border-[#E85D75]/25 bg-[#E85D75]/12 text-[#F6A7B5]'
      : displayStatus === 'overdue'
        ? 'border-[#E85D75]/25 bg-[#E85D75]/12 text-[#F6A7B5]'
        : displayStatus === 'sent'
          ? 'border-[#39AEB3]/25 bg-[#39AEB3]/12 text-[#B8D3D7]'
          : 'border-white/10 bg-white/6 text-[#D7DEEE]';

  const handlePayNow = async () => {
    if (!isPayable || isPaid) return;
    setPaying(true);
    window.location.assign(checkoutUrl);
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              Invoice {data.invoice_number}
            </h1>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClasses}`}
            >
              {displayStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {isPaid
              ? `Paid on ${formatDate(data.paid_at)}`
              : displayStatus === 'overdue'
                ? 'Overdue'
                : data.status === 'sent'
                  ? 'Awaiting payment'
                  : displayStatus}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-[#465B6F]/50 bg-[#1A2740]/70 text-[#F7F9FC] hover:border-[#7DBCBD]/40 hover:bg-[#22344D]"
          >
            <a href={pdfUrl}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
          {isPayable && (
            <Button
              size="sm"
              onClick={handlePayNow}
              disabled={paying}
              className="bg-[#57C87F] text-[#09111F] hover:bg-[#6BD48F]"
            >
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay now
            </Button>
          )}
        </div>
      </div>

      {data.client && (
        <div className="mt-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Bill to</h2>
          <p className="mt-1 font-medium text-white">{clientName}</p>
          {data.client.company_name && (
            <p className="text-sm text-zinc-300">{data.client.company_name}</p>
          )}
          {data.client.email && (
            <p className="text-sm text-zinc-400">{data.client.email}</p>
          )}
          {(data.client.address_line_1 ||
            data.client.city ||
            data.client.postcode) && (
            <p className="mt-1 text-sm text-zinc-400">
              {[data.client.address_line_1, data.client.address_line_2]
                .filter(Boolean)
                .join(', ')}
              <br />
              {[data.client.city, data.client.postcode]
                .filter(Boolean)
                .join(' ')}
              {data.client.country ? `, ${data.client.country}` : ''}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-zinc-500">Due date</span>
          <p className="font-medium text-zinc-200">
            {formatDate(data.due_at)}
          </p>
        </div>
        {data.issued_at && (
          <div>
            <span className="text-zinc-500">Issued</span>
            <p className="font-medium text-zinc-200">
              {formatDate(data.issued_at)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-zinc-400">
              <th className="pb-3 pr-4 font-medium">Description</th>
              <th className="w-24 pb-3 pr-4 text-right font-medium">Qty</th>
              <th className="w-32 pb-3 pr-4 text-right font-medium">
                Unit price
              </th>
              <th className="w-28 pb-3 pr-4 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.items ?? []).map((row, index) => (
              <tr
                key={index}
                className="border-b border-zinc-700/70 text-zinc-300"
              >
                <td className="py-3 pr-4">{row.description}</td>
                <td className="py-3 pr-4 text-right">{row.quantity}</td>
                <td className="py-3 pr-4 text-right">
                  {formatPence(row.unit_price_pence)}
                </td>
                <td className="py-3 pr-4 text-right">
                  {formatPence(row.total_pence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end border-t border-zinc-700 pt-4">
          <p className="text-lg font-semibold text-white">
            Total {formatPence(data.total_pence)}
          </p>
        </div>
      </div>

      {data.notes && (
        <div className="mt-6 rounded-md bg-zinc-800/50 p-3">
          <p className="text-sm text-zinc-400">{data.notes}</p>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-white/6 bg-[#122033] px-4 py-4 shadow-[0_18px_40px_rgba(2,8,23,0.22)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#F7F9FC]">
              Want a client account for future invoices?
            </p>
            <p className="mt-1 text-sm text-[#AAB4C8]">
              Sign in to Keel to see invoices, job details, progress
              updates, and messages in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[#465B6F]/50 bg-[#1A2740]/70 text-[#F7F9FC] hover:border-[#7DBCBD]/40 hover:bg-[#22344D]"
            >
              <Link href={signInHref}>Client login</Link>
            </Button>

            <Button
              asChild
              size="sm"
              className="bg-[#57C87F] text-[#09111F] hover:bg-[#6BD48F]"
            >
              <Link href={signUpHref}>Client sign up</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
