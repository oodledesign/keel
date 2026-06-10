'use client';

import { useMemo } from 'react';

import { formatPence } from '../_lib/invoice-totals';

type Summary = {
  issued_pence: number;
  paid_pence: number;
  unpaid_pence: number;
  overdue_pence: number;
  chart: Array<{ date: string; amount_pence: number }>;
};

export function InvoicesIncomeSummary({
  summary,
  period,
  onPeriodChange,
}: {
  summary: Summary | null;
  period: 'month_to_date' | 'last_30_days' | 'last_90_days';
  onPeriodChange: (period: 'month_to_date' | 'last_30_days' | 'last_90_days') => void;
}) {
  const maxBar = useMemo(
    () => Math.max(...(summary?.chart.map((d) => d.amount_pence) ?? [1]), 1),
    [summary?.chart],
  );

  if (!summary) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Income summary
        </h2>
        <select
          value={period}
          onChange={(e) =>
            onPeriodChange(
              e.target.value as 'month_to_date' | 'last_30_days' | 'last_90_days',
            )
          }
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--workspace-shell-text)]"
        >
          <option value="month_to_date">Month to date</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Issued', value: summary.issued_pence, color: 'text-[#B8D3D7]' },
          { label: 'Paid', value: summary.paid_pence, color: 'text-[#97D9AA]' },
          { label: 'Unpaid', value: summary.unpaid_pence, color: 'text-amber-200' },
          { label: 'Overdue', value: summary.overdue_pence, color: 'text-[#F6A7B5]' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-white/6 bg-white/3 px-3 py-3"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`mt-1 text-lg font-semibold ${item.color}`}>
              {formatPence(item.value)}
            </p>
          </div>
        ))}
      </div>

      {summary.chart.length > 0 ? (
        <div className="mt-5 flex h-24 items-end gap-1">
          {summary.chart.map((point) => (
            <div
              key={point.date}
              className="group relative flex-1"
              title={`${point.date}: ${formatPence(point.amount_pence)}`}
            >
              <div
                className="w-full rounded-t bg-[var(--keel-teal)]/70 transition-all group-hover:bg-[var(--keel-teal)]"
                style={{
                  height: `${Math.max(4, (point.amount_pence / maxBar) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No issued invoices in this period.</p>
      )}
    </div>
  );
}
