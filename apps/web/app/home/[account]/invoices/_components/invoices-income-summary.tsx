'use client';

import { useMemo } from 'react';

import { formatInvoiceMoney } from '../_lib/invoice-currency';

type Summary = {
  issued_pence: number;
  paid_pence: number;
  unpaid_pence: number;
  overdue_pence: number;
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
  const maxBar = useMemo(
    () => Math.max(...(summary?.chart.map((d) => d.amount_pence) ?? [1]), 1),
    [summary?.chart],
  );
  const hasChartData =
    summary?.chart.some((point) => point.amount_pence > 0) ?? false;

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

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 shadow-sm"
          >
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p className={`mt-1 text-lg font-semibold ${item.color}`}>
              {formatInvoiceMoney(item.value, currency)}
            </p>
          </div>
        ))}
      </div>

      {hasChartData ? (
        <div className="mt-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 shadow-sm">
          <div className="flex h-20 items-end gap-1">
            {summary.chart.map((point) => (
              <div
                key={point.date}
                className="group relative flex-1"
                title={`${point.date}: ${formatInvoiceMoney(point.amount_pence, currency)}`}
              >
                <div
                  className="w-full rounded-t bg-[var(--ozer-accent)]/70 transition-all group-hover:bg-[var(--ozer-accent)]"
                  style={{
                    height: `${Math.max(4, (point.amount_pence / maxBar) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
