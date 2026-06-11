import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { GroupDashboardData } from './group-dashboard.loader';
import { loadGroupDashboardData } from './group-dashboard.loader';
import {
  loadFinanceDashboardSummary,
  type FinanceDashboardSummary,
} from './finance-dashboard-summary.loader';

export type { FinanceDashboardSummary };

export type PropertyStatusCounts = {
  total: number;
  active: number;
  vacant: number;
  maintenance: number;
  sold: number;
};

export type PropertyDashboardData = GroupDashboardData & {
  propertyCounts: PropertyStatusCounts;
  openMaintenanceJobs: number;
  openTasksCount: number;
  financeSummary: FinanceDashboardSummary;
};

function isTableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

export const loadPropertyDashboardData = cache(
  async (accountSlug: string): Promise<PropertyDashboardData> => {
    const client = getSupabaseServerClient();

    const { data: accountRow } = await client
      .from('accounts')
      .select('id')
      .eq('slug', accountSlug)
      .maybeSingle();

    const accountId = (accountRow as { id?: string } | null)?.id;

    const [groupData, propertiesResult, jobsResult, projectsResult, financeSummary] =
      await Promise.all([
        loadGroupDashboardData(accountSlug),
        accountId
          ? client
              .from('properties')
              .select('status')
              .eq('account_id', accountId)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? client
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', accountId)
              .not('status', 'in', '("completed","cancelled")')
          : Promise.resolve({ count: 0, error: null }),
        accountId
          ? client
              .from('projects')
              .select('id')
              .eq('account_id', accountId)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? loadFinanceDashboardSummary(client, accountId)
          : Promise.resolve({
              financeIncomePence: 0,
              financeExpensePence: 0,
              financeNetPence: 0,
              hasFinanceData: false,
              financeTrend: [],
            }),
      ]);

    type PropertyRow = { status?: string | null };
    const rows = ((propertiesResult as { data?: unknown[] | null }).data ??
      []) as PropertyRow[];

    const propertyCounts: PropertyStatusCounts = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      vacant: rows.filter((r) => r.status === 'vacant').length,
      maintenance: rows.filter((r) => r.status === 'maintenance').length,
      sold: rows.filter((r) => r.status === 'sold').length,
    };

    const openMaintenanceJobs = isTableMissing(
      (jobsResult as { error?: { message?: string; code?: string } | null })
        .error ?? null,
    )
      ? 0
      : ((jobsResult as { count?: number | null }).count ?? 0);

    const projectIds = (
      (projectsResult as { data?: Array<{ id: string }> | null }).data ?? []
    ).map((p) => p.id);

    let openTasksCount = 0;
    if (projectIds.length > 0) {
      const { count, error } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .is('parent_task_id', null)
        .not('status', 'eq', 'done');

      if (!isTableMissing(error)) {
        openTasksCount = count ?? 0;
      }
    }

    return {
      ...groupData,
      propertyCounts,
      openMaintenanceJobs,
      openTasksCount,
      financeSummary,
    };
  },
);
