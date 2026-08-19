'use client';

import { Info } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import {
  AnalyticsDateRangePicker,
  type DateRangeSelection,
} from '~/components/date-range/analytics-date-range-picker';

import { formatInvoiceMoney } from '../_lib/invoice-currency';

type CurrencyBreakdownRow = {
  currency: string;
  issued_pence: number;
  paid_pence: number;
  unpaid_pence: number;
  overdue_pence: number;
  draft_pence: number;
};

type Summary = {
  issued_pence: number;
  paid_pence: number;
  unpaid_pence: number;
  overdue_pence: number;
  draft_pence: number;
  currency?: string;
  mixed_currencies?: boolean;
  fx_estimated?: boolean;
  fx_as_of?: string | null;
  currency_breakdown?: CurrencyBreakdownRow[];
  chart: Array<{ date: string; amount_pence: number }>;
};

function BreakdownTooltip({
  summary,
  displayCurrency,
}: {
  summary: Summary;
  displayCurrency: string;
}) {
  const rows = summary.currency_breakdown ?? [];
  const asOf = summary.fx_as_of
    ? new Date(`${summary.fx_as_of}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 rounded-full text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
            aria-label="Currency breakdown"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs text-xs leading-relaxed whitespace-normal"
        >
          <p>
            Totals include other currencies, converted to{' '}
            {displayCurrency.toUpperCase()}. Currency conversion is an estimate
            {asOf ? ` (rates as of ${asOf})` : ''}.
          </p>
          <ul className="mt-2 space-y-1.5">
            {rows.map((row) => (
              <li key={row.currency}>
                <span className="font-medium">
                  {row.currency.toUpperCase()}
                </span>
                {': '}
                issued {formatInvoiceMoney(row.issued_pence, row.currency)}
                {' · '}
                paid {formatInvoiceMoney(row.paid_pence, row.currency)}
                {' · '}
                unpaid {formatInvoiceMoney(row.unpaid_pence, row.currency)}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InvoicesIncomeSummary({
  summary,
  dateFrom,
  dateTo,
  isLoading = false,
  onDateRangeApply,
}: {
  summary: Summary | null;
  dateFrom: string;
  dateTo: string;
  isLoading?: boolean;
  onDateRangeApply: (
    fromIso: string,
    toIso: string,
    selection: DateRangeSelection,
  ) => void;
}) {
  const currency = summary?.currency ?? 'gbp';
  const showFxHint = Boolean(summary?.mixed_currencies);

  if (!summary) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Income summary
          </h2>
          {showFxHint ? (
            <BreakdownTooltip summary={summary} displayCurrency={currency} />
          ) : null}
        </div>
        <AnalyticsDateRangePicker
          fromIso={dateFrom}
          toIso={dateTo}
          isLoading={isLoading}
          showMonthStepper
          onApply={onDateRangeApply}
        />
      </div>

      <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
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
            className="w-[25vw] min-w-[25vw] shrink-0 snap-start rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-3 shadow-sm md:w-auto md:min-w-0 md:px-4"
          >
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p
              className={`mt-1 text-base font-semibold md:text-lg ${item.color}`}
            >
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
