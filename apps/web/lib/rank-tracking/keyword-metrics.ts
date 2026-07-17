import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  estimateKeywordOverviewCostUsd,
  fetchKeywordOverviewMetrics,
} from '~/lib/dataforseo/keywords';
import { projectCountryToCode } from '~/lib/site-overview/domain';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { logDataForSeoUsage } from './db';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function enrichProjectKeywordMetrics(input: {
  projectId: string;
  keywordIds?: string[];
  force?: boolean;
}): Promise<{
  updated: number;
  skipped: number;
  estimatedCostUsd: number;
}> {
  const { data: project, error: projectError } = await ranklyAdmin()
    .from('projects')
    .select('id, target_country')
    .eq('id', input.projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Project not found');
  }

  let query = ranklyAdmin()
    .from('keywords')
    .select('id, keyword, metrics_updated_at')
    .eq('project_id', input.projectId)
    .order('created_at', { ascending: true });

  if (input.keywordIds?.length) {
    query = query.in('id', input.keywordIds);
  }

  const { data: keywordRows, error: keywordError } = await query;

  if (keywordError) {
    throw new Error(keywordError.message);
  }

  const rows = (keywordRows ?? []).filter((row) => {
    if (input.force) return true;
    return row.metrics_updated_at == null;
  });

  if (rows.length === 0) {
    return {
      updated: 0,
      skipped: keywordRows?.length ?? 0,
      estimatedCostUsd: 0,
    };
  }

  const countryCode = projectCountryToCode(
    String(project.target_country ?? 'gb'),
  );
  const metricsByKeyword = await fetchKeywordOverviewMetrics(
    rows.map((row) => String(row.keyword)),
    countryCode,
  );

  const now = new Date().toISOString();
  let updated = 0;

  for (const row of rows) {
    const metrics = metricsByKeyword.get(
      String(row.keyword).trim().toLowerCase(),
    );

    const { error } = await ranklyAdmin()
      .from('keywords')
      .update({
        search_volume: metrics?.search_volume ?? 0,
        keyword_difficulty: metrics?.keyword_difficulty ?? 0,
        cpc: metrics?.cpc ?? 0,
        intent: metrics?.intent ?? 'informational',
        metrics_updated_at: now,
      })
      .eq('id', row.id as string);

    if (!error) {
      updated += 1;
    }
  }

  const estimatedCostUsd = estimateKeywordOverviewCostUsd(rows.length);

  await logDataForSeoUsage({
    projectId: input.projectId,
    endpoint: '/dataforseo_labs/google/keyword_overview/live',
    taskCount: rows.length,
    estimatedCostUsd,
    featureArea: 'keyword_metrics',
  });

  return {
    updated,
    skipped: (keywordRows?.length ?? 0) - rows.length,
    estimatedCostUsd,
  };
}
