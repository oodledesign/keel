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

export type MonthlyFinancePoint = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  isCurrent?: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

const tooltipStyle = {
  backgroundColor: 'var(--workspace-shell-panel)',
  border: '1px solid var(--workspace-shell-border)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--workspace-shell-text)',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
};

const WORKSPACE_CHART_TICK = 'var(--workspace-shell-text-muted)';
const WORKSPACE_CHART_GRID = 'color-mix(in srgb, var(--workspace-shell-border) 70%, transparent)';

const GROUPED_INCOME_COLOR = '#FF5C34';
const GROUPED_EXPENSES_COLOR = '#94A3B8';

function FinanceGroupedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MonthlyFinancePoint }>;
  label?: string;
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
      <p className="mb-2 font-medium text-[var(--workspace-shell-text)]">{label}</p>
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
            {formatCurrency(point.income)}
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
            {formatCurrency(point.expenses)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-[color:var(--workspace-shell-border)] pt-1.5">
          <span className="text-[var(--workspace-shell-text-muted)]">Net</span>
          <span className="font-medium text-[var(--ozer-accent-muted)]">
            {formatCurrency(point.net)}
          </span>
        </div>
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
}: {
  data: MonthlyFinancePoint[];
  variant?: 'stacked' | 'grouped';
  surface?: 'default' | 'workspace';
}) {
  const isWorkspaceSurface = surface === 'workspace';
  const axisTickFill = isWorkspaceSurface ? WORKSPACE_CHART_TICK : '#8FA1BC';
  const gridStroke = isWorkspaceSurface ? WORKSPACE_CHART_GRID : 'rgba(255,255,255,0.05)';
  const legendColor = isWorkspaceSurface
    ? 'var(--workspace-shell-text-muted)'
    : '#D7DEEE';
  const cursorFill = isWorkspaceSurface
    ? 'color-mix(in srgb, var(--ozer-accent) 8%, transparent)'
    : 'rgba(255,255,255,0.035)';
  if (!data.length) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-violet-200/60">
        No finance data for this period yet.
      </p>
    );
  }

  if (variant === 'grouped') {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: axisTickFill, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: axisTickFill, fontSize: 11 }}
              tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
            />
            <Tooltip cursor={{ fill: cursorFill }} content={<FinanceGroupedTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: legendColor }} />
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
              formatCurrency(Number(value)),
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

export function FinanceNetLineChart({ data }: { data: MonthlyFinancePoint[] }) {
  if (!data.length) return null;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8FA1BC', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8FA1BC', fontSize: 11 }}
            tickFormatter={(v) => formatCurrency(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [formatCurrency(Number(value)), 'Net']}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#FFE3DA"
            strokeWidth={2}
            dot={{ fill: '#FFE3DA', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceMonthRail({
  data,
}: {
  data: MonthlyFinancePoint[];
}) {
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
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">{month.month}</p>
            <span className="text-sm font-semibold text-violet-300">
              {formatCurrency(month.net)}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-violet-100/80">
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Income</span>
              <span>{formatCurrency(month.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Expenses</span>
              <span>{formatCurrency(month.expenses)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-violet-200/70">Net</span>
              <span>{formatCurrency(month.net)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { formatCurrency as formatFinanceCurrency };
