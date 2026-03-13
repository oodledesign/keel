'use client';

import { useCallback, useEffect, useState } from 'react';

import { ReceiptText } from 'lucide-react';
import Link from 'next/link';

import pathsConfig from '~/config/paths.config';

import { listClientInvoices } from '../_lib/server/server-actions';

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: string;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  total_pence: number | null;
  created_at: string;
};

function formatPence(pence: number | null) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format((pence ?? 0) / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';

  try {
    return new Date(iso).toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}

function getDisplayStatus(invoice: InvoiceRow) {
  const isOverdue =
    invoice.status === 'sent' &&
    invoice.due_at &&
    new Date(invoice.due_at) < new Date(new Date().toDateString());

  return isOverdue ? 'overdue' : invoice.status;
}

function getStatusClasses(status: string) {
  if (status === 'paid') {
    return 'bg-emerald-500/15 text-emerald-300';
  }

  if (status === 'overdue') {
    return 'bg-rose-500/15 text-rose-300';
  }

  if (status === 'sent') {
    return 'bg-sky-500/15 text-sky-300';
  }

  return 'bg-zinc-700/70 text-zinc-200';
}

export function ClientInvoicesBlock({
  accountSlug,
  accountId,
  clientId,
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientInvoices({ accountId, clientId });
      setInvoices((data ?? []) as InvoiceRow[]);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const invoiceEditBase = pathsConfig.app.accountInvoiceEdit.replace(
    '[account]',
    accountSlug,
  ).replace('/[id]/edit', '');

  return (
    <div className="space-y-3 border-t border-zinc-700 pt-4">
      <h3 className="text-sm font-semibold text-white">Invoices</h3>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No invoices linked to this client yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((invoice) => {
            const displayStatus = getDisplayStatus(invoice);

            return (
              <li key={invoice.id}>
                <Link
                  href={`${invoiceEditBase}/${invoice.id}/edit`}
                  className="flex items-center gap-3 rounded-md border border-zinc-700 bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm transition hover:border-zinc-600 hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <ReceiptText className="h-4 w-4 shrink-0 text-zinc-400" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {invoice.invoice_number ?? 'Draft invoice'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {displayStatus === 'paid'
                        ? `Paid ${formatDate(invoice.paid_at)}`
                        : `Due ${formatDate(invoice.due_at)}`}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClasses(displayStatus)}`}
                  >
                    {displayStatus}
                  </span>

                  <span className="shrink-0 font-medium text-white">
                    {formatPence(invoice.total_pence)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
