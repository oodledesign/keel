import { describe, expect, it } from 'vitest';

import {
  mapFinanceDashboardToNative,
  withNativeFinanceDashboard,
} from './finances-dashboard';
import { summariseNativeFinances } from './invoices-shared';

describe('mapFinanceDashboardToNative', () => {
  it('formats this-month totals and maps expenses to outgoings', () => {
    const mapped = mapFinanceDashboardToNative(
      {
        financeIncomePence: 120_050,
        financeExpensePence: 40_000,
        financeNetPence: 80_050,
        hasFinanceData: true,
        financeTrend: [
          {
            month: 'Apr',
            monthKey: '2026-04',
            income: 1200.5,
            expenses: 400,
            net: 800.5,
            isCurrent: false,
          },
          {
            month: 'Sep',
            monthKey: '2026-09',
            income: 0,
            expenses: 0,
            net: 0,
            isCurrent: true,
          },
        ],
      },
      'gbp',
    );

    expect(mapped.period).toBe('this_month');
    expect(mapped.period_label).toBe('This month');
    expect(mapped.income_pence).toBe(120_050);
    expect(mapped.outgoings_pence).toBe(40_000);
    expect(mapped.net_pence).toBe(80_050);
    expect(mapped.has_finance_data).toBe(true);
    expect(mapped.months).toEqual([
      {
        month: 'Apr',
        month_key: '2026-04',
        income: 1200.5,
        outgoings: 400,
        net: 800.5,
        is_current: false,
      },
      {
        month: 'Sep',
        month_key: '2026-09',
        income: 0,
        outgoings: 0,
        net: 0,
        is_current: true,
      },
    ]);
    expect(mapped.income).toContain('1,200.50');
    expect(mapped.outgoings).toContain('400.00');
  });
});

describe('withNativeFinanceDashboard', () => {
  it('keeps invoice outstanding and overlays dashboard totals', () => {
    const pocket = summariseNativeFinances([]);
    const merged = withNativeFinanceDashboard(pocket, {
      financeIncomePence: 5000,
      financeExpensePence: 2000,
      financeNetPence: 3000,
      hasFinanceData: true,
      financeTrend: [],
    });

    expect(merged.outstanding_balance_pence).toBe(0);
    expect(merged.income_pence).toBe(5000);
    expect(merged.outgoings_pence).toBe(2000);
    expect(merged.net_pence).toBe(3000);
    expect(merged.has_finance_data).toBe(true);
  });

  it('resets dashboard fields when the summary is missing', () => {
    const pocket = withNativeFinanceDashboard(summariseNativeFinances([]), {
      financeIncomePence: 5000,
      financeExpensePence: 0,
      financeNetPence: 5000,
      hasFinanceData: true,
      financeTrend: [],
    });

    const cleared = withNativeFinanceDashboard(pocket, null);
    expect(cleared.income_pence).toBe(0);
    expect(cleared.has_finance_data).toBe(false);
    expect(cleared.months).toEqual([]);
  });
});
