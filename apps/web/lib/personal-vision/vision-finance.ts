import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFinanceDashboardSummary } from '~/home/[account]/_lib/server/finance-dashboard-summary.loader';

import type { VisionFinanceActuals } from './build-vision-slides';

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

  for (let i = 0; i < uniqueIds.length; i++) {
    const accountId = uniqueIds[i]!;
    const summary = summaries[i];
    if (!summary) continue;
    incomePence += summary.financeIncomePence;
    if (summary.hasFinanceData) hasFinanceData = true;
    const name = workspaceNamesById.get(accountId);
    if (name) workspaceNames.push(name);
  }

  return {
    incomePence,
    hasFinanceData,
    workspaceNames,
  };
}
