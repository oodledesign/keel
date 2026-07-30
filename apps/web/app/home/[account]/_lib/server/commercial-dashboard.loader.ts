import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type CommercialReportsMetrics,
  createCommercialReportsService,
} from '../../commercial-reports/_lib/server/commercial-reports.service';
import { loadTeamWorkspace } from './team-account-workspace.loader';

export type CommercialDashboardListing = {
  id: string;
  name: string;
  status: string;
  disposalType: string;
  town: string | null;
  postcode: string | null;
  updatedAt: string;
};

export type CommercialDashboardData = {
  accountSlug: string;
  accountId: string;
  metrics: CommercialReportsMetrics;
  recentListings: CommercialDashboardListing[];
};

export async function loadCommercialDashboardData(
  accountSlug: string,
): Promise<CommercialDashboardData> {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  // Untyped until `pnpm supabase:web:typegen` includes commercial_* tables.
  const client = getSupabaseServerClient() as unknown as SupabaseClient;

  const [metrics, listingsResult] = await Promise.all([
    createCommercialReportsService(client).getMetrics(accountId),
    client
      .from('commercial_listings')
      .select('id, name, status, disposal_type, town, postcode, updated_at')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(6),
  ]);

  if (listingsResult.error) {
    console.error(
      '[commercial-dashboard] recent listings:',
      listingsResult.error.message,
    );
  }

  const recentListings: CommercialDashboardListing[] = (
    (listingsResult.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    disposalType: row.disposal_type as string,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    updatedAt: row.updated_at as string,
  }));

  return {
    accountSlug,
    accountId,
    metrics,
    recentListings,
  };
}
