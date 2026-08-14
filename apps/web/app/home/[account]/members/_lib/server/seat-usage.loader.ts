import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { getMemberSeatUsage } from '~/lib/billing/entitlements';
import { getCommercialSeatBreakdown } from '~/lib/commercial/commercial-seat-access';

import type { SeatUsageSummaryProps } from '../../_components/seat-usage-summary';

export async function loadSeatUsageSummary(
  client: SupabaseClient,
  accountId: string,
  accountSlug: string,
  workspaceProfile: WorkspaceProfile,
): Promise<SeatUsageSummaryProps> {
  const billingHref = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  if (workspaceProfile === 'commercial_property') {
    const breakdown = await getCommercialSeatBreakdown(client, accountId);
    return {
      mode: 'commercial',
      used: breakdown.billableCount + breakdown.supportCount,
      max: breakdown.maxMembers,
      remaining: Math.max(
        0,
        breakdown.maxMembers -
          (breakdown.billableCount + breakdown.supportCount),
      ),
      billableUsed: breakdown.billableCount,
      billableMax: breakdown.subscribedBillable,
      supportUsed: breakdown.supportCount,
      supportMax: breakdown.supportAllowance,
      billingHref,
    };
  }

  const usage = await getMemberSeatUsage(client, accountId);

  if (usage.unlimited || usage.maxMembers == null) {
    return {
      mode: 'unlimited',
      used: usage.used,
      max: null,
      remaining: null,
      billingHref,
    };
  }

  return {
    mode: 'standard',
    used: usage.used,
    max: usage.maxMembers,
    remaining: usage.remaining,
    billingHref,
  };
}
