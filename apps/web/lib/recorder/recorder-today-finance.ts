import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { loadFinanceDashboardSummary } from '~/home/[account]/_lib/server/finance-dashboard-summary.loader';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';
import { normalizeWorkspaceCurrency } from '~/lib/currency/workspace-currency';

import {
  type RecorderTodayFinance,
  mapDashboardTrendToRecorderMonths,
  pickFinanceWorkspace,
} from './recorder-today-finance.shared';

export type {
  FinanceWorkspaceCandidate,
  RecorderTodayFinance,
  RecorderTodayFinanceMonth,
} from './recorder-today-finance.shared';

export {
  mapDashboardTrendToRecorderMonths,
  pickFinanceWorkspace,
} from './recorder-today-finance.shared';

export async function loadRecorderTodayFinance(
  admin: SupabaseClient,
  userId: string,
  preferredAccountId?: string | null,
): Promise<RecorderTodayFinance | null> {
  const workspaces = await loadUserWorkspaceAccounts(admin, userId);
  const candidates = workspaces.filter((workspace) =>
    Boolean(workspace.id && workspace.slug),
  );

  if (candidates.length === 0) {
    return null;
  }

  const summaries = await Promise.all(
    candidates.map(async (workspace) => {
      try {
        const summary = await loadFinanceDashboardSummary(admin, workspace.id);
        return { workspace, summary };
      } catch (error) {
        console.error('[recorder/today] finance summary', workspace.id, error);
        return { workspace, summary: null };
      }
    }),
  );

  const withDataIds = new Set(
    summaries
      .filter((entry) => entry.summary?.hasFinanceData)
      .map((entry) => entry.workspace.id),
  );

  const selected = pickFinanceWorkspace(
    candidates,
    withDataIds,
    preferredAccountId,
  );
  if (!selected) {
    return null;
  }

  const selectedEntry = summaries.find(
    (entry) => entry.workspace.id === selected.id,
  );
  const summary = selectedEntry?.summary;
  if (!summary?.hasFinanceData) {
    return null;
  }

  let currency = 'gbp';
  try {
    currency = await getWorkspaceCurrencyWithClient(
      admin as Parameters<typeof getWorkspaceCurrencyWithClient>[0],
      selected.id,
    );
  } catch (error) {
    console.error('[recorder/today] finance currency', selected.id, error);
    currency = normalizeWorkspaceCurrency(null);
  }

  const slug = selected.slug?.trim();
  if (!slug) {
    return null;
  }

  return {
    account_id: selected.id,
    workspace_slug: slug,
    workspace_name: selected.name?.trim() || slug,
    currency,
    path: workAccountPath(pathsConfig.app.accountFinances, slug),
    income_pence: summary.financeIncomePence,
    outgoings_pence: summary.financeExpensePence,
    net_pence: summary.financeNetPence,
    months: mapDashboardTrendToRecorderMonths(summary.financeTrend),
  };
}
