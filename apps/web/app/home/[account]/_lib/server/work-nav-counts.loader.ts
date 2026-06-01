import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

export async function loadWorkNavCounts(
  client: SupabaseClient,
  accountId: string,
  moduleSettings?: Record<string, boolean>,
): Promise<WorkNavCounts> {
  const counts: WorkNavCounts = {};

  if (!isWorkModuleEnabled(moduleSettings, 'support_tickets')) {
    return counts;
  }

  try {
    const { count, error } = await client
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', accountId)
      .in('status', ['open', 'in-progress', 'waiting']);

    if (error) {
      console.error('[work-nav-counts] supportOpenCount:', error.message);
      return counts;
    }

    counts.supportOpenCount = count ?? 0;
  } catch (error) {
    console.error('[work-nav-counts] supportOpenCount:', error);
  }

  return counts;
}
