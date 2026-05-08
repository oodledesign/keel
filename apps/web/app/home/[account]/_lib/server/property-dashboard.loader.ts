import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { GroupDashboardData } from './group-dashboard.loader';
import { loadGroupDashboardData } from './group-dashboard.loader';

export type PropertyStatusCounts = {
  total: number;
  active: number;
  vacant: number;
  maintenance: number;
  sold: number;
};

export type PropertyDashboardData = GroupDashboardData & {
  propertyCounts: PropertyStatusCounts;
};

export const loadPropertyDashboardData = cache(
  async (accountSlug: string): Promise<PropertyDashboardData> => {
    const client = getSupabaseServerClient();

    // Resolve account_id from slug
    const { data: accountRow } = await client
      .from('accounts')
      .select('id')
      .eq('slug', accountSlug)
      .maybeSingle();

    const accountId = (accountRow as { id?: string } | null)?.id;

    const [groupData, propertiesResult] = await Promise.all([
      loadGroupDashboardData(accountSlug),
      accountId
        ? client
            .from('properties')
            .select('status')
            .eq('account_id', accountId)
        : Promise.resolve({ data: [] }),
    ]);

    type PropertyRow = { status?: string | null };
    const rows = ((propertiesResult as { data?: unknown[] | null }).data ?? []) as PropertyRow[];

    const propertyCounts: PropertyStatusCounts = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      vacant: rows.filter((r) => r.status === 'vacant').length,
      maintenance: rows.filter((r) => r.status === 'maintenance').length,
      sold: rows.filter((r) => r.status === 'sold').length,
    };

    return { ...groupData, propertyCounts };
  },
);
