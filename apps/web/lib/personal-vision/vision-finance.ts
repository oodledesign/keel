import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFinanceDashboardSummary } from '~/home/[account]/_lib/server/finance-dashboard-summary.loader';

import type {
  VisionFinanceActuals,
  VisionFinanceMonthPoint,
} from './build-vision-slides';

export async function loadVisionFinanceActuals(
  client: SupabaseClient,
  accountIds: string[],
  workspaceNamesById: Map<string, string>,
): Promise<VisionFinanceActuals | null> {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];
  if (!uniqueIds.length) return null;

  const summaries = await Promise.all(
    uniqueIds.map(async (accountId) => {
      try {
        return await loadFinanceDashboardSummary(client, accountId);
      } catch {
        return null;
      }
    }),
  );

  let incomePence = 0;
  let hasFinanceData = false;
  const workspaceNames: string[] = [];
  const monthMap = new Map<string, VisionFinanceMonthPoint>();

  for (let i = 0; i < uniqueIds.length; i++) {
    const accountId = uniqueIds[i]!;
    const summary = summaries[i];
    if (!summary) continue;
    incomePence += summary.financeIncomePence;
    if (summary.hasFinanceData) hasFinanceData = true;
    const name = workspaceNamesById.get(accountId);
    if (name) workspaceNames.push(name);

    for (const point of summary.financeTrend) {
      const monthKey =
        'monthKey' in point && typeof point.monthKey === 'string'
          ? point.monthKey
          : point.month;
      const existing = monthMap.get(monthKey);
      const incomePenceMonth = Math.round(point.income * 100);
      if (existing) {
        existing.incomePence += incomePenceMonth;
      } else {
        monthMap.set(monthKey, {
          monthKey,
          monthLabel: point.month,
          incomePence: incomePenceMonth,
          isCurrent: point.isCurrent,
        });
      }
    }
  }

  const monthlyIncome = [...monthMap.values()].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );

  const monthsWithIncome = monthlyIncome.filter((m) => m.incomePence > 0);
  const averageIncomePence = monthsWithIncome.length
    ? Math.round(
        monthsWithIncome.reduce((sum, m) => sum + m.incomePence, 0) /
          monthsWithIncome.length,
      )
    : 0;

  return {
    incomePence,
    hasFinanceData,
    workspaceNames,
    monthlyIncome,
    averageIncomePence,
  };
}
