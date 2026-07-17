export type LastUnit =
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years';

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | 'last'
  | 'period_to_date'
  | 'custom';

export type LastSubPreset =
  | 'last_30_minutes'
  | 'last_12_hours'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_365_days'
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_12_months'
  | 'last_year'
  | 'last_financial_year';

export type PeriodSubPreset =
  | 'week_to_date'
  | 'month_to_date'
  | 'quarter_to_date'
  | 'year_to_date'
  | 'financial_year_to_date';

export type ResolvedDateRange = {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
};

export type DateRangeSelection = {
  preset: AnalyticsDatePreset;
  lastSubPreset?: LastSubPreset;
  periodSubPreset?: PeriodSubPreset;
  lastCount?: number;
  lastUnit?: LastUnit;
  includeToday?: boolean;
  customFrom?: Date;
  customTo?: Date;
};

export const DEFAULT_DATE_RANGE: DateRangeSelection = {
  preset: 'last',
  lastSubPreset: 'last_30_days',
  lastCount: 30,
  lastUnit: 'days',
  includeToday: true,
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

/** UK tax / financial year starts 6 April. */
function ukFinancialYearStart(d: Date) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  if (month > 3 || (month === 3 && day >= 6)) {
    return startOfDay(new Date(year, 3, 6));
  }
  return startOfDay(new Date(year - 1, 3, 6));
}

function previousUkFinancialYearRange(now: Date): { from: Date; to: Date } {
  const currentStart = ukFinancialYearStart(now);
  const from = startOfDay(new Date(currentStart));
  from.setFullYear(from.getFullYear() - 1);
  const to = endOfDay(subtractDays(currentStart, 1));
  return { from, to };
}

function subtractDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

function subtractMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() - months);
  return x;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolveAnalyticsDateRange(
  selection: DateRangeSelection,
  now = new Date(),
): ResolvedDateRange {
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (selection.preset === 'today') {
    return {
      from: today,
      to: todayEnd,
      fromIso: toIsoDate(today),
      toIso: toIsoDate(today),
    };
  }

  if (selection.preset === 'yesterday') {
    const y = subtractDays(today, 1);
    return {
      from: y,
      to: endOfDay(y),
      fromIso: toIsoDate(y),
      toIso: toIsoDate(y),
    };
  }

  if (selection.preset === 'period_to_date') {
    const sub = selection.periodSubPreset ?? 'month_to_date';
    if (sub === 'financial_year_to_date') {
      const from = ukFinancialYearStart(today);
      return {
        from,
        to: todayEnd,
        fromIso: toIsoDate(from),
        toIso: toIsoDate(today),
      };
    }
    const from =
      sub === 'week_to_date'
        ? startOfWeek(today)
        : sub === 'month_to_date'
          ? startOfMonth(today)
          : sub === 'quarter_to_date'
            ? startOfQuarter(today)
            : startOfYear(today);
    return {
      from,
      to: todayEnd,
      fromIso: toIsoDate(from),
      toIso: toIsoDate(today),
    };
  }

  if (selection.preset === 'custom') {
    const from = startOfDay(selection.customFrom ?? today);
    const to = endOfDay(selection.customTo ?? today);
    return { from, to, fromIso: toIsoDate(from), toIso: toIsoDate(to) };
  }

  // preset === 'last'
  const sub = selection.lastSubPreset;
  const includeToday = selection.includeToday !== false;
  const end = includeToday ? todayEnd : endOfDay(subtractDays(today, 1));

  if (sub === 'last_30_minutes') {
    const from = new Date(end.getTime() - 30 * 60_000);
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_12_hours') {
    const from = new Date(end.getTime() - 12 * 60 * 60_000);
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_week') {
    const from = startOfWeek(subtractDays(end, 7));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_month') {
    const from = startOfMonth(subtractMonths(end, 1));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_quarter') {
    const from = startOfQuarter(subtractMonths(end, 3));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_12_months') {
    const from = startOfMonth(subtractMonths(end, 12));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_year') {
    const from = startOfYear(subtractMonths(end, 12));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (sub === 'last_financial_year') {
    const { from, to } = previousUkFinancialYearRange(end);
    return { from, to, fromIso: toIsoDate(from), toIso: toIsoDate(to) };
  }

  const count = selection.lastCount ?? 30;
  const unit = selection.lastUnit ?? 'days';

  if (unit === 'minutes') {
    const from = new Date(end.getTime() - count * 60_000);
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (unit === 'hours') {
    const from = new Date(end.getTime() - count * 60 * 60_000);
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (unit === 'weeks') {
    const from = subtractDays(
      startOfDay(end),
      count * 7 - (includeToday ? 0 : 1),
    );
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (unit === 'months') {
    const from = startOfDay(subtractMonths(end, count));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }
  if (unit === 'years') {
    const from = startOfDay(subtractMonths(end, count * 12));
    return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
  }

  // days — map known sub-presets
  const dayCount =
    sub === 'last_7_days'
      ? 7
      : sub === 'last_90_days'
        ? 90
        : sub === 'last_365_days'
          ? 365
          : count;

  const from = subtractDays(startOfDay(end), dayCount - (includeToday ? 1 : 0));
  return { from, to: end, fromIso: toIsoDate(from), toIso: toIsoDate(end) };
}

export function formatDateRangeLabel(selection: DateRangeSelection): string {
  if (selection.preset === 'today') return 'Today';
  if (selection.preset === 'yesterday') return 'Yesterday';
  if (selection.preset === 'custom') {
    const range = resolveAnalyticsDateRange(selection);
    const fmt = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (range.fromIso === range.toIso) return fmt.format(range.from);
    return `${fmt.format(range.from)} – ${fmt.format(range.to)}`;
  }

  if (selection.preset === 'period_to_date') {
    const map: Record<PeriodSubPreset, string> = {
      week_to_date: 'Week to date',
      month_to_date: 'Month to date',
      quarter_to_date: 'Quarter to date',
      year_to_date: 'Year to date',
      financial_year_to_date: 'Financial year to date',
    };
    return map[selection.periodSubPreset ?? 'month_to_date'];
  }

  const subLabels: Record<LastSubPreset, string> = {
    last_30_minutes: 'Last 30 minutes',
    last_12_hours: 'Last 12 hours',
    last_7_days: 'Last 7 days',
    last_30_days: 'Last 30 days',
    last_90_days: 'Last 90 days',
    last_365_days: 'Last 365 days',
    last_week: 'Last week',
    last_month: 'Last month',
    last_quarter: 'Last quarter',
    last_12_months: 'Last 12 months',
    last_year: 'Last year',
    last_financial_year: 'Last financial year',
  };

  if (selection.lastSubPreset && subLabels[selection.lastSubPreset]) {
    return subLabels[selection.lastSubPreset];
  }

  const count = selection.lastCount ?? 30;
  const unit = selection.lastUnit ?? 'days';
  const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);
  return `Last ${count} ${unitLabel}`;
}

export function aggregateTransactionsByMonth(
  transactions: Array<{
    transaction_date: string;
    amount_pence: number;
    is_transfer?: boolean | null;
  }>,
  months = 6,
): Array<{
  month: string;
  monthKey: string;
  income: number;
  expenses: number;
  net: number;
  isCurrent: boolean;
}> {
  const now = new Date();
  const buckets: Array<{
    month: string;
    monthKey: string;
    income: number;
    expenses: number;
    net: number;
    isCurrent: boolean;
  }> = [];

  const formatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      month: formatter.format(d),
      monthKey: key,
      income: 0,
      expenses: 0,
      net: 0,
      isCurrent: i === 0,
    });
  }

  const bucketMap = new Map(buckets.map((b) => [b.monthKey, b]));

  for (const tx of transactions) {
    if (tx.is_transfer) continue;

    const key = String(tx.transaction_date).slice(0, 7);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    const pence = tx.amount_pence;
    if (pence >= 0) bucket.income += pence / 100;
    else bucket.expenses += Math.abs(pence) / 100;
    bucket.net = bucket.income - bucket.expenses;
  }

  return buckets;
}
