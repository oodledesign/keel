import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';
import {
  type DashboardTrendPoint,
  mapDashboardTrendToRecorderMonths,
} from '~/lib/recorder/recorder-today-finance.shared';

import {
  NATIVE_FINANCE_PERIOD,
  NATIVE_FINANCE_PERIOD_LABEL,
  type NativeFinances,
  emptyNativeFinanceDashboard,
} from './invoices-shared';

export type NativeFinanceDashboardSummary = {
  financeIncomePence: number;
  financeExpensePence: number;
  financeNetPence: number;
  hasFinanceData: boolean;
  financeTrend: DashboardTrendPoint[];
};

export function mapFinanceDashboardToNative(
  summary: NativeFinanceDashboardSummary,
  currency: string,
): ReturnType<typeof emptyNativeFinanceDashboard> {
  return {
    period: NATIVE_FINANCE_PERIOD,
    period_label: NATIVE_FINANCE_PERIOD_LABEL,
    income: formatWorkspaceMoney(summary.financeIncomePence, currency),
    income_pence: summary.financeIncomePence,
    outgoings: formatWorkspaceMoney(summary.financeExpensePence, currency),
    outgoings_pence: summary.financeExpensePence,
    net: formatWorkspaceMoney(summary.financeNetPence, currency),
    net_pence: summary.financeNetPence,
    has_finance_data: summary.hasFinanceData,
    months: mapDashboardTrendToRecorderMonths(summary.financeTrend),
  };
}

export function withNativeFinanceDashboard(
  pocket: NativeFinances,
  summary: NativeFinanceDashboardSummary | null,
  currency = pocket.currency,
): NativeFinances {
  if (!summary) {
    return {
      ...pocket,
      ...emptyNativeFinanceDashboard(currency),
    };
  }

  return {
    ...pocket,
    ...mapFinanceDashboardToNative(summary, currency),
  };
}
