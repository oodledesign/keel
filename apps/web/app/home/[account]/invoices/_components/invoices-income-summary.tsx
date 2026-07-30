'use client';

import { formatInvoiceMoney } from '../_lib/invoice-currency';

type Summary = {
  issued_pence: number;
  paid_pence: number;
  unpaid_pence: number;
  overdue_pence: number;
  draft_pence: number;
  currency?: string;
  mixed_currencies?: boolean;
  chart: Array<{ date: string; amount_pence: number }>;
};

export function InvoicesIncomeSummary({
  summary,
  period,
  onPeriodChange,
}: {
  summary: Summary | null;
  period: 'month_to_date' | 'last_30_days' | 'last_90_days';
  onPeriodChange: (
    period: 'month_to_date' | 'last_30_days' | 'last_90_days',
  ) => void;
}) {
  const currency = summary?.currency ?? 'gbp';

  if (!summary) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Income summary
        </h2>
        <select
          value={period}
          onChange={(e) =>
            onPeriodChange(
              e.target.value as
                | 'month_to_date'
                | 'last_30_days'
                | 'last_90_days',
            )
          }
          className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1.5 text-xs text-[var(--workspace-shell-text)]"
        >
          <option value="month_to_date">Month to date</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
        </select>
      </div>

      {summary.mixed_currencies ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Totals shown in your default invoice currency (
          {currency.toUpperCase()}). Invoices in other currencies are excluded.
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: 'Issued',
            value: summary.issued_pence,
            color: 'text-[#1D767B]',
          },
          {
            label: 'Paid',
            value: summary.paid_pence,
            color: 'text-emerald-600',
          },
          {
            label: 'Unpaid',
            value: summary.unpaid_pence,
            color: 'text-amber-600',
          },
          {
            label: 'Overdue',
            value: summary.overdue_pence,
            color: 'text-[#C4455C]',
          },
          {
            label: 'Drafts',
            value: summary.draft_pence ?? 0,
            color: 'text-[var(--workspace-shell-text-muted)]',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 shadow-sm"
          >
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p className={`mt-1 text-lg font-semibold ${item.color}`}>
              {formatInvoiceMoney(item.value, currency)}
            </p>
            {item.label === 'Drafts' ? (
              <p className="text-muted-foreground mt-1 text-[11px]">
                All open drafts
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
