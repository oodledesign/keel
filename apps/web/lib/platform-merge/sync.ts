import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type MergeSourceApp = 'keel' | 'feedflow' | 'rankly';

/** Generated `Database` types only cover `public`; `platform_merge` is exposed via PostgREST config. */
function platformMergeDb() {
  return (getSupabaseServerAdminClient() as SupabaseClient).schema(
    'platform_merge',
  );
}

export async function getLatestSyncRuns(limit = 20) {
  const { data, error } = await platformMergeDb()
    .from('sync_runs')
    .select('id,source_app,sync_mode,status,started_at,finished_at,stats,error')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getLatestDriftChecks(limit = 50) {
  const { data, error } = await platformMergeDb()
    .from('drift_checks')
    .select(
      'id,source_app,entity_type,source_count,target_count,delta,sampled_equal,details,checked_at',
    )
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function recordDriftCheck(input: {
  sourceApp: MergeSourceApp;
  entityType: string;
  sourceCount: number;
  targetCount: number;
  sampledEqual: boolean;
  details?: Record<string, unknown>;
}) {
  const delta = input.targetCount - input.sourceCount;

  const { error } = await platformMergeDb()
    .from('drift_checks')
    .insert({
      source_app: input.sourceApp,
      entity_type: input.entityType,
      source_count: input.sourceCount,
      target_count: input.targetCount,
      delta,
      sampled_equal: input.sampledEqual,
      details: input.details ?? {},
    });

  if (error) {
    throw error;
  }
}
