import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  estimateSerpCredits,
  expandSeeds,
  filterCandidates,
} from '~/lib/dataforseo/keywords';
import {
  buildClusters,
  fetchSerpsForKeywords,
  mergeHighOverlapKeywords,
} from '~/lib/dataforseo/serp';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  buildArchitecture,
  buildLinkMap,
  mergeCannibalisingPlans,
  prioritise,
  runQualityGates,
} from './architecture';
import {
  getClusterJob,
  saveKeywordCandidates,
  savePlan,
  updateJobStatus,
} from './db';
import type { ClusterKeyword } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function runClusterExpansion(jobId: string): Promise<void> {
  const db = ranklyAdmin();

  try {
    const job = await getClusterJob(jobId);
    await updateJobStatus(jobId, 'expanding');

    const candidates = await expandSeeds(job.seeds, job.country);
    const filtered = filterCandidates(candidates, job.min_volume, job.max_kd);

    const estimatedCredits = estimateSerpCredits(filtered.length);

    await db.from('keyword_cluster_keywords').delete().eq('job_id', jobId);
    await saveKeywordCandidates(jobId, filtered);

    await updateJobStatus(jobId, 'awaiting_confirmation', {
      credits_used: estimatedCredits,
      candidate_count: filtered.length,
    });
  } catch (error) {
    await db
      .from('keyword_cluster_jobs')
      .update({
        status: 'error',
        error_msg: error instanceof Error ? error.message : 'Expansion failed',
      })
      .eq('id', jobId);
    throw error;
  }
}

export async function runClusterSerpAndSave(jobId: string): Promise<void> {
  const db = ranklyAdmin();

  try {
    const job = await getClusterJob(jobId);

    const { data: keywordRows, error: keywordError } = await db
      .from('keyword_cluster_keywords')
      .select('keyword, volume, kd, cpc, intent')
      .eq('job_id', jobId);

    if (keywordError) {
      throw new Error(keywordError.message);
    }

    const filtered: ClusterKeyword[] = (keywordRows ?? []).map(
      (row: {
        keyword: string;
        volume: number | null;
        kd: number | null;
        cpc: number | null;
        intent: string | null;
      }) => ({
        keyword: row.keyword,
        search_volume: Number(row.volume ?? 0),
        keyword_difficulty: Number(row.kd ?? 0),
        cpc: Number(row.cpc ?? 0),
        intent: (row.intent as ClusterKeyword['intent']) ?? 'informational',
      }),
    );

    if (filtered.length === 0) {
      throw new Error('No candidate keywords to cluster');
    }

    await updateJobStatus(jobId, 'fetching_serps');

    const serpCache = await fetchSerpsForKeywords(
      filtered.map((keyword) => keyword.keyword),
      job.country,
    );

    await updateJobStatus(jobId, 'clustering');

    let drafts = buildClusters(filtered, serpCache);
    drafts = mergeHighOverlapKeywords(drafts, serpCache);

    let plans = buildArchitecture(drafts);
    plans = prioritise(plans);

    let quality = runQualityGates(plans, serpCache);
    if (
      quality.some(
        (gate) => gate.gate === 'cannibalisation' && gate.status === 'fail',
      )
    ) {
      plans = mergeCannibalisingPlans(plans, serpCache);
      quality = runQualityGates(plans, serpCache);
    }

    const links = buildLinkMap(plans);

    await updateJobStatus(jobId, 'saving');

    await db.from('keyword_clusters').delete().eq('job_id', jobId);

    await savePlan(jobId, plans, quality, filtered, links);

    await updateJobStatus(jobId, 'done', {
      credits_used: estimateSerpCredits(filtered.length),
      candidate_count: filtered.length,
    });
  } catch (error) {
    await db
      .from('keyword_cluster_jobs')
      .update({
        status: 'error',
        error_msg:
          error instanceof Error ? error.message : 'Cluster job failed',
      })
      .eq('id', jobId);
    throw error;
  }
}

export async function runClusterJob(jobId: string): Promise<void> {
  await runClusterExpansion(jobId);
}
