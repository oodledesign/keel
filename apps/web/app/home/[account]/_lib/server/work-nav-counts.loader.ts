import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';

import { countOpenSupportTickets } from '../../support/_lib/server/support-tickets.service';

export async function loadWorkNavCounts(
  client: SupabaseClient,
  accountId: string,
  moduleSettings?: Record<string, boolean>,
): Promise<WorkNavCounts> {
  const counts: WorkNavCounts = {};

  if (isWorkModuleEnabled(moduleSettings, 'support_tickets')) {
    counts.supportOpenCount = await countOpenSupportTickets(client, accountId);
  }

  return counts;
}
