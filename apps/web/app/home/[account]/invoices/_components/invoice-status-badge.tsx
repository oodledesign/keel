'use client';

import { displayInvoiceStatus, formatPence } from '../_lib/invoice-totals';

const STATUS_STYLES: Record<string, string> = {
  draft:
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
  sent: 'border-[#2A8F94]/45 bg-[#39AEB3]/20 text-[#14575B]',
  read: 'border-amber-700/40 bg-amber-500/20 text-amber-950',
  overdue: 'border-[#C4455C]/40 bg-[#E85D75]/18 text-[#8F2F42]',
  paid: 'border-emerald-700/40 bg-emerald-500/18 text-emerald-900',
  partial: 'border-violet-700/40 bg-violet-500/18 text-violet-950',
  void: 'border-[color:var(--workspace-shell-border)]/30 bg-[var(--workspace-shell-panel-hover)]/20 text-[var(--workspace-shell-text-muted)]',
  cancelled:
    'border-[color:var(--workspace-shell-border)]/30 bg-[var(--workspace-shell-panel-hover)]/20 text-[var(--workspace-shell-text-muted)]',
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
