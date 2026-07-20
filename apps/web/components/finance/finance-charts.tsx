'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  formatWorkspaceAmount,
  normalizeWorkspaceCurrency,
  workspaceCurrencySymbol,
} from '~/lib/currency/workspace-currency';

export type MonthlyFinancePoint = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  isCurrent?: boolean;
};

function formatChartCurrency(value: number, currency = 'gbp'): string {
  return formatWorkspaceAmount(value, currency, {
    maximumFractionDigits: 0,
  });
}

function compactAxisLabel(value: number, currency = 'gbp'): string {
  const symbol = workspaceCurrencySymbol(currency);
  const major = Math.round(value / 1000);
  return `${symbol}${major}k`;
}

const tooltipStyle = {
  backgroundColor: 'var(--workspace-shell-panel)',
  border: '1px solid var(--workspace-shell-border)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--workspace-shell-text)',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
};

const tooltipLabelStyle = {
  color: 'var(--workspace-shell-text)',
  fontWeight: 600,
  marginBottom: 4,
};

const tooltipItemStyle = {
  color: 'var(--workspace-shell-text)',
  fontWeight: 500,
};

const WORKSPACE_CHART_TICK = 'var(--workspace-shell-text-muted)';
const WORKSPACE_CHART_GRID =
  'color-mix(in srgb, var(--workspace-shell-border) 70%, transparent)';

const GROUPED_INCOME_COLOR = '#FF5C34';
const GROUPED_EXPENSES_COLOR = '#94A3B8';
const NET_TREND_COLOR = GROUPED_INCOME_COLOR;

function FinanceGroupedTooltip({
  active,
  payload,
  label,
  currency = 'gbp',
}: {
  active?: boolean;
  payload?: Array<{ payload?: MonthlyFinancePoint }>;
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-[var(--workspace-shell-text)]">
        {label}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-[var(--workspace-shell-text-muted)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: GROUPED_INCOME_COLOR }}
            />
            Income
          </span>
          <span className="font-medium text-[var(--workspace-shell-text)]">
            {formatChartCurrency(point.income, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-[var(--workspace-shell-text-muted)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: GROUPED_EXPENSES_COLOR }}
            />
            Expenses
          </span>
          <span className="font-medium text-[var(--workspace-shell-text)]">
            {formatChartCurrency(point.expenses, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-[color:var(--workspace-shell-border)] pt-1.5">
          <span className="flex items-center gap-2 text-[var(--workspace-shell-text)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: NET_TREND_COLOR }}
            />
            Net
          </span>
          <span className="font-semibold text-[var(--workspace-shell-text)]">
            {formatChartCurrency(point.net, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function FinanceNetTooltip({
  active,
  payload,
  label,
  currency = 'gbp',
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-[var(--workspace-shell-text)]">
        {label}
      </p>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-2 text-[var(--workspace-shell-text)]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: NET_TREND_COLOR }}
          />
          Net
        </span>
        <span className="font-semibold text-[var(--workspace-shell-text)]">
          {formatChartCurrency(value, currency)}
        </span>
      </div>
    </div>
  );
}

function seriesLabel(name: string) {
  const key = name.toLowerCase();
  if (key === 'income') return 'Income';
  if (key === 'expenses') return 'Expenses';
  if (key === 'net') return 'Net';
  return name;
}

export function FinanceTrendBarChart({
  data,
  variant = 'stacked',
  surface = 'default',
  compact = false,
  currency = 'gbp',
}: {
  data: MonthlyFinancePoint[];
  variant?: 'stacked' | 'grouped';
  surface?: 'default' | 'workspace';
  /** Shorter dashboard embed — fills parent height instead of fixed 18rem. */
  compact?: boolean;
  currency?: string;
}) {
  const resolvedCurrency = normalizeWorkspaceCurrency(currency);
  const isWorkspaceSurface = surface === 'workspace';
  const axisTickFill = isWorkspaceSurface ? WORKSPACE_CHART_TICK : '#8FA1BC';
  const gridStroke = isWorkspaceSurface
    ? WORKSPACE_CHART_GRID
    : 'rgba(255,255,255,0.05)';
  const legendColor = isWorkspaceSurface
    ? 'var(--workspace-shell-text-muted)'
    : '#D7DEEE';
  const cursorFill = isWorkspaceSurface
    ? 'color-mix(in srgb, var(--ozer-accent) 8%, transparent)'
    : 'rgba(255,255,255,0.035)';
  const chartShellClass = compact ? 'h-full min-h-0' : 'h-72';
  const chartMargin = compact
    ? { top: 4, right: 4, left: -12, bottom: 0 }
    : undefined;
  if (!data.length) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-violet-200/60">
        No finance data for this period yet.
      </p>
    );
  }

  if (variant === 'grouped') {
    return (
      <div className={chartShellClass}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%" margin={chartMargin}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: axisTickFill, fontSize: compact ? 11 : 12 }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
              tick={{ fill: axisTickFill, fontSize: compact ? 10 : 11 }}
              tickFormatter={(v) => compactAxisLabel(v, resolvedCurrency)}
              width={compact ? 36 : 60}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              content={<FinanceGroupedTooltip currency={resolvedCurrency} />}
            />
            {!compact ? (
              <Legend wrapperStyle={{ fontSize: 12, color: legendColor }} />
            ) : null}
            <Bar
              dataKey="income"
              name="Income"
              fill={GROUPED_INCOME_COLOR}
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill={GROUPED_EXPENSES_COLOR}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8FA1BC', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.035)' }}
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              formatChartCurrency(Number(value), resolvedCurrency),
              seriesLabel(name),
            ]}
          />
          <Bar dataKey="expenses" stackId="finance" radius={[0, 0, 10, 10]}>
            {data.map((entry) => (
              <Cell
                key={`${entry.month}-expenses`}
                fill={entry.isCurrent ? '#3C8D63' : '#176A72'}
              />
            ))}
          </Bar>
          <Bar dataKey="net" stackId="finance" radius={[10, 10, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={`${entry.month}-net`}
                fill={entry.isCurrent ? '#A78BFA' : '#7C3AED'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceNetLineChart({
  data,
  currency = 'gbp',
}: {
  data: MonthlyFinancePoint[];
  currency?: string;
}) {
  const resolvedCurrency = normalizeWorkspaceCurrency(currency);

  if (!data.length) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-[var(--workspace-shell-text-muted)]">
        No finance data for this period yet.
      </p>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
            vertical={false}
            stroke="color-mix(in srgb, var(--workspace-shell-border) 70%, transparent)"
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--workspace-shell-text-muted)', fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--workspace-shell-text-muted)', fontSize: 11 }}
            tickFormatter={(v) => formatChartCurrency(v, resolvedCurrency)}
          />
          <Tooltip
            content={<FinanceNetTooltip currency={resolvedCurrency} />}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke={NET_TREND_COLOR}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{
              fill: NET_TREND_COLOR,
              stroke: NET_TREND_COLOR,
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              fill: NET_TREND_COLOR,
              stroke: 'var(--workspace-shell-panel)',
              strokeWidth: 2,
              r: 6,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceMonthRail({
  data,
  currency = 'gbp',
}: {
  data: MonthlyFinancePoint[];
  currency?: string;
}) {
  const resolvedCurrency = normalizeWorkspaceCurrency(currency);
  const recent = [...data].reverse().slice(0, 3);

  return (
    <div className="space-y-3">
      {recent.map((month, index) => (
        <div
          key={month.month}
          className={`rounded-2xl border px-4 py-4 ${
            month.isCurrent || index === 0
              ? 'border-violet-400/60 bg-[var(--workspace-shell-panel)] shadow-[0_0_0_1px_rgba(167,139,250,0.16)]'
              : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {month.month}
            </p>
            <span className="text-sm font-semibold text-violet-300">
              {formatChartCurrency(month.net, resolvedCurrency)}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-violet-100/80">
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Income</span>
              <span>{formatChartCurrency(month.income, resolvedCurrency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Expenses</span>
              <span>
                {formatChartCurrency(month.expenses, resolvedCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Net</span>
              <span>{formatChartCurrency(month.net, resolvedCurrency)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatFinanceCurrency(value: number, currency = 'gbp'): string {
  return formatChartCurrency(value, currency);
}
