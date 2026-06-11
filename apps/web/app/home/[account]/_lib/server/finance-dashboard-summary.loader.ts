import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  aggregateTransactionsByMonth,
} from '~/lib/date-range/analytics-date-range';
import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';

import type { DashboardFinanceMonth } from './dashboard-page.loader';

export type FinanceDashboardSummary = {
  financeIncomePence: number;
  financeExpensePence: number;
  financeNetPence: number;
  hasFinanceData: boolean;
  financeTrend: DashboardFinanceMonth[];
};

function isFinanceTableMissing(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

export async function loadFinanceDashboardSummary(
  client: SupabaseClient,
  accountId: string,
): Promise<FinanceDashboardSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartDate = monthStart.toISOString().slice(0, 10);

  const financeTrendStart = new Date();
  financeTrendStart.setMonth(financeTrendStart.getMonth() - 5);
  financeTrendStart.setDate(1);
  const financeTrendStartIso = financeTrendStart.toISOString().slice(0, 10);

  const [financeMonthResult, financeTrendResult] = await Promise.all([
    client
      .from('finance_transactions')
      .select('amount_pence, is_transfer')
      .eq('account_id', accountId)
      .gte('transaction_date', monthStartDate),
    client
      .from('finance_transactions')
      .select('transaction_date, amount_pence, is_transfer')
      .eq('account_id', accountId)
      .gte('transaction_date', financeTrendStartIso)
      .order('transaction_date', { ascending: true }),
  ]);

  const financeUnavailable = isFinanceTableMissing(financeMonthResult.error);

  let financeIncomePence = 0;
  let financeExpensePence = 0;
  if (!financeUnavailable) {
    const totals = accumulateFinanceTotals(
      (financeMonthResult.data ?? []).map((row) => ({
        amount_pence: (row.amount_pence as number | null) ?? 0,
        is_transfer: row.is_transfer as boolean | null | undefined,
      })),
    );
    financeIncomePence = totals.incomePence;
    financeExpensePence = totals.expensePence;
  }

  const financeTrend = financeUnavailable
    ? []
    : aggregateTransactionsByMonth(
        (financeTrendResult.data ?? []).map((row) => ({
          transaction_date: row.transaction_date as string,
          amount_pence: (row.amount_pence as number | null) ?? 0,
          is_transfer: row.is_transfer as boolean | null | undefined,
        })),
        6,
      );

  const hasFinanceData =
    !financeUnavailable &&
    ((financeTrendResult.data?.length ?? 0) > 0 ||
      financeIncomePence > 0 ||
      financeExpensePence > 0);

  return {
    financeIncomePence,
    financeExpensePence,
    financeNetPence: financeIncomePence - financeExpensePence,
    hasFinanceData,
    financeTrend,
  };
}
