export type FinanceChartPoint = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

type FinanceTxLike = {
  transaction_date: string;
  amount_pence: number;
  is_transfer?: boolean | null;
};

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daySpan(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  return Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
}

/**
 * Build chart points for the selected finance date range.
 * Short ranges (≤ 62 days) use daily buckets; longer ranges use months.
 * Empty buckets stay in the series so changing the picker always changes the axis.
 */
export function buildFinanceChartSeries(
  rows: FinanceTxLike[],
  dateFrom: string,
  dateTo: string,
): FinanceChartPoint[] {
  if (!dateFrom || !dateTo) return [];

  const span = daySpan(dateFrom, dateTo);
  const useDaily = span <= 62;

  const buckets = new Map<
    string,
    { label: string; income: number; expenses: number; net: number }
  >();

  if (useDaily) {
    const dayFmt = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    const cursor = parseIsoDate(dateFrom);
    const end = parseIsoDate(dateTo);
    while (cursor <= end) {
      const key = toIsoDate(cursor);
      buckets.set(key, {
        label: dayFmt.format(cursor),
        income: 0,
        expenses: 0,
        net: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const from = parseIsoDate(dateFrom);
    const to = parseIsoDate(dateTo);
    const start = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    const spanYears = end.getFullYear() !== start.getFullYear();
    const monthFmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      ...(spanYears ? { year: '2-digit' as const } : {}),
    });

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, {
        label: monthFmt.format(cursor),
        income: 0,
        expenses: 0,
        net: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  for (const tx of rows) {
    if (tx.is_transfer) continue;
    const key = useDaily
      ? String(tx.transaction_date).slice(0, 10)
      : String(tx.transaction_date).slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const pence = tx.amount_pence;
    if (pence >= 0) bucket.income += pence / 100;
    else bucket.expenses += Math.abs(pence) / 100;
    bucket.net = bucket.income - bucket.expenses;
  }

  return [...buckets.values()].map((bucket) => ({
    month: bucket.label,
    income: bucket.income,
    expenses: bucket.expenses,
    net: bucket.net,
  }));
}

export function isDailyFinanceChartRange(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) return false;
  return daySpan(dateFrom, dateTo) <= 62;
}
