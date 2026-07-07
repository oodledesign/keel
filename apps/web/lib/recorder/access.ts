import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import { hasEntitlement, isAccountBillingExempt } from '~/lib/billing/entitlements';

export type RecorderAccessTier = 'limited' | 'standard';

export const RECORDER_LIMITS = {
  limited: {
    maxDurationSecondsPerMonth: 45 * 60,
  },
  standard: {
    maxDurationSecondsPerMonth: 5 * 60 * 60,
  },
} as const satisfies Record<
  RecorderAccessTier,
  { maxDurationSecondsPerMonth: number }
>;

const FULL_PAID_ENTITLEMENTS = [
  'workspace_business_lite',
  'workspace_business',
  'workspace_community',
  'workspace_property',
] as const;

export type RecorderUsageSummary = {
  tier: RecorderAccessTier;
  period: string;
  durationSeconds: number;
  limits: (typeof RECORDER_LIMITS)[RecorderAccessTier];
  remainingDurationSeconds: number;
};

function currentUsagePeriod(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export async function resolveRecorderAccessTier(
  client: SupabaseClient,
  userId: string,
): Promise<RecorderAccessTier> {
  if (await isSuperAdmin(client)) {
    return 'standard';
  }

  if (await isAccountBillingExempt(client, userId)) {
    return 'standard';
  }

  const workspaces = await loadUserWorkspaceAccounts(client, userId);

  for (const workspace of workspaces) {
    if (await isAccountBillingExempt(client, workspace.id)) {
      return 'standard';
    }

    for (const entitlement of FULL_PAID_ENTITLEMENTS) {
      if (await hasEntitlement(client, workspace.id, entitlement)) {
        return 'standard';
      }
    }
  }

  return 'limited';
}

async function loadUsageRow(userId: string, period: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('recorder_usage_monthly')
    .select('sync_count, duration_seconds')
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    syncCount: (data?.sync_count as number | undefined) ?? 0,
    durationSeconds: (data?.duration_seconds as number | undefined) ?? 0,
  };
}

export async function loadRecorderUsageSummary(
  client: SupabaseClient,
  userId: string,
): Promise<RecorderUsageSummary> {
  const tier = await resolveRecorderAccessTier(client, userId);
  const limits = RECORDER_LIMITS[tier];
  const period = currentUsagePeriod();
  const usage = await loadUsageRow(userId, period);

  return {
    tier,
    period,
    durationSeconds: usage.durationSeconds,
    limits,
    remainingDurationSeconds: Math.max(
      0,
      limits.maxDurationSecondsPerMonth - usage.durationSeconds,
    ),
  };
}

export class RecorderUsageLimitError extends Error {
  readonly status = 429;
  readonly summary: RecorderUsageSummary;

  constructor(message: string, summary: RecorderUsageSummary) {
    super(message);
    this.name = 'RecorderUsageLimitError';
    this.summary = summary;
  }
}

export async function assertRecorderSyncAllowed(
  client: SupabaseClient,
  userId: string,
  durationSeconds = 0,
) {
  const summary = await loadRecorderUsageSummary(client, userId);
  const nextDuration = Math.max(0, durationSeconds);

  if (
    summary.durationSeconds + nextDuration >
    summary.limits.maxDurationSecondsPerMonth
  ) {
    const remainingMinutes = Math.ceil(summary.remainingDurationSeconds / 60);
    throw new RecorderUsageLimitError(
      remainingMinutes > 0
        ? `Desktop recorder limit: about ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} left this month. Upgrade a paid workspace for more recording time.`
        : 'Desktop recorder recording time limit reached for this month. Upgrade a paid workspace for more recording time.',
      summary,
    );
  }

  return summary;
}

export async function recordRecorderSync(
  userId: string,
  durationSeconds = 0,
) {
  const admin = getSupabaseServerAdminClient();
  const period = currentUsagePeriod();
  const incrementDuration = Math.max(0, durationSeconds);
  const existing = await loadUsageRow(userId, period);

  const { error } = await admin.from('recorder_usage_monthly').upsert(
    {
      user_id: userId,
      period,
      sync_count: existing.syncCount + 1,
      duration_seconds: existing.durationSeconds + incrementDuration,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,period' },
  );

  if (error) {
    throw new Error(error.message);
  }
}
