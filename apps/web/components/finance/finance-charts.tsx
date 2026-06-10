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
  backgroundColor: '#0B1524',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  fontSize: 12,
  color: '#F7F9FC',
  boxShadow: '0 12px 30px rgba(2, 8, 23, 0.35)',
};

export function FinanceTrendBarChart({
  data,
  variant = 'stacked',
}: {
  data: MonthlyFinancePoint[];
  variant?: 'stacked' | 'grouped';
}) {
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
              tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.035)' }}
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [
                formatCurrency(Number(value)),
                name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Net',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#D7DEEE' }} />
            <Bar dataKey="income" name="Income" fill="#2A9D8F" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#176A72" radius={[6, 6, 0, 0]} />
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
              name === 'net' ? 'Net' : name === 'expenses' ? 'Expenses' : 'Income',
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
            stroke="#5eead4"
            strokeWidth={2}
            dot={{ fill: '#5eead4', r: 3 }}
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
              : 'border-white/6 bg-[var(--workspace-shell-panel)]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{month.month}</p>
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
