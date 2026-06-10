'use client';

import { displayInvoiceStatus, formatPence } from '../_lib/invoice-totals';

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  sent: 'border-[#39AEB3]/30 bg-[#39AEB3]/12 text-[#B8D3D7]',
  read: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  overdue: 'border-[#E85D75]/30 bg-[#E85D75]/12 text-[#F6A7B5]',
  paid: 'border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/12 text-[#97D9AA]',
  partial: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  void: 'border-zinc-600/30 bg-zinc-700/20 text-zinc-400',
  cancelled: 'border-zinc-600/30 bg-zinc-700/20 text-zinc-400',
};

export function InvoiceStatusBadge({
  status,
  due_at,
  amount_paid_pence,
  total_pence,
}: {
  status: string;
  due_at?: string | null;
  amount_paid_pence?: number;
  total_pence?: number;
}) {
  const display = displayInvoiceStatus({
    status,
    due_at,
    amount_paid_pence,
    total_pence,
  });
  const label = display.toUpperCase();
  const classes = STATUS_STYLES[display] ?? STATUS_STYLES.draft;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${classes}`}
    >
      {label}
    </span>
  );
}

export function formatInvoiceMoney(pence: number, currency = 'GBP') {
  return formatPence(pence, currency);
}
