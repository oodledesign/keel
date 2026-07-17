import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type {
  ClusterJobRow,
  ClusterKeyword,
  ClusterLink,
  ClusterPlan,
  QualityGateResult,
} from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function getClusterJob(jobId: string): Promise<ClusterJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('keyword_cluster_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Cluster job not found');
  }

  return data as ClusterJobRow;
}

export async function updateJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('keyword_cluster_jobs')
    .update({ status, ...extra })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }
}

export async function saveKeywordCandidates(
  jobId: string,
  keywords: ClusterKeyword[],
): Promise<void> {
  if (keywords.length === 0) return;

  const rows = keywords.map((keyword) => ({
    job_id: jobId,
    keyword: keyword.keyword,
    volume: keyword.search_volume,
    kd: keyword.keyword_difficulty,
    cpc: keyword.cpc,
    intent: keyword.intent,
    role: 'secondary' as const,
  }));

  const { error } = await ranklyAdmin()
    .from('keyword_cluster_keywords')
    .insert(rows);

  if (error) {
    throw new Error(`Failed to save keyword candidates: ${error.message}`);
  }
}

export async function savePlan(
  jobId: string,
  plans: ClusterPlan[],
  quality: QualityGateResult[],
  filteredKeywords: ClusterKeyword[],
  links: ClusterLink[],
): Promise<void> {
  const db = ranklyAdmin();

  await db.from('keyword_cluster_keywords').delete().eq('job_id', jobId);
  await db.from('keyword_cluster_links').delete().eq('job_id', jobId);
  await db.from('keyword_cluster_quality').delete().eq('job_id', jobId);

  for (const plan of plans) {
    const { data: clusterRow, error: clusterError } = await db
      .from('keyword_clusters')
      .insert({
        id: plan.id,
        job_id: jobId,
        name: plan.name,
        role: plan.role,
        primary_keyword: plan.primary_keyword,
        secondary_keywords: plan.secondary_keywords,
        total_volume: plan.total_volume,
        weighted_kd: plan.weighted_kd,
        priority_score: plan.priority_score,
        intent: plan.intent,
        pillar_h1: plan.pillar_h1,
        pillar_h2s: plan.pillar_h2s,
        build_order: plan.build_order,
      })
      .select('id')
      .single();

    if (clusterError || !clusterRow) {
      throw new Error(clusterError?.message ?? 'Failed to save cluster');
    }

    const clusterId = clusterRow.id as string;

    if (plan.spokes.length) {
      const spokeRows = plan.spokes.map((spoke) => ({
        cluster_id: clusterId,
        title: spoke.title,
        target_keyword: spoke.target_keyword,
        volume: spoke.volume,
        h1: spoke.h1,
        h2s: spoke.h2s,
        position: spoke.position,
      }));

      const { error: spokeError } = await db
        .from('keyword_cluster_spokes')
        .insert(spokeRows);

      if (spokeError) {
        throw new Error(`Failed to save spokes: ${spokeError.message}`);
      }
    }

    const keywordRows = filteredKeywords
      .filter((keyword) =>
        [plan.primary_keyword, ...plan.secondary_keywords].includes(
          keyword.keyword,
        ),
      )
      .map((keyword) => ({
        job_id: jobId,
        keyword: keyword.keyword,
        volume: keyword.search_volume,
        kd: keyword.keyword_difficulty,
        cpc: keyword.cpc,
        intent: keyword.intent,
        cluster_id: clusterId,
        role:
          keyword.keyword === plan.primary_keyword
            ? ('primary' as const)
            : ('secondary' as const),
      }));

    if (keywordRows.length) {
      const { error: keywordError } = await db
        .from('keyword_cluster_keywords')
        .insert(keywordRows);

      if (keywordError) {
        throw new Error(
          `Failed to save cluster keywords: ${keywordError.message}`,
        );
      }
    }
  }

  if (quality.length) {
    const { error: qualityError } = await db
      .from('keyword_cluster_quality')
      .insert(
        quality.map((gate) => ({
          job_id: jobId,
          gate: gate.gate,
          status: gate.status,
          detail: gate.detail,
        })),
      );

    if (qualityError) {
      throw new Error(`Failed to save quality gates: ${qualityError.message}`);
    }
  }

  if (links.length) {
    const { error: linkError } = await db.from('keyword_cluster_links').insert(
      links.map((link) => ({
        job_id: jobId,
        from_cluster_id: link.from_cluster_id,
        to_cluster_id: link.to_cluster_id,
        link_type: link.link_type,
      })),
    );

    if (linkError) {
      throw new Error(`Failed to save link map: ${linkError.message}`);
    }
  }
}

export async function loadClusterJobBundle(jobId: string) {
  const db = ranklyAdmin();

  const { data: job, error: jobError } = await db
    .from('keyword_cluster_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message ?? 'Job not found');
  }

  const { data: clusters } = await db
    .from('keyword_clusters')
    .select('*')
    .eq('job_id', jobId)
    .order('build_order', { ascending: true });

  const clusterIds = (clusters ?? []).map((row: { id: string }) => row.id);

  const { data: spokes } = clusterIds.length
    ? await db
        .from('keyword_cluster_spokes')
        .select('*')
        .in('cluster_id', clusterIds)
        .order('position', { ascending: true })
    : { data: [] };

  const { data: quality } = await db
    .from('keyword_cluster_quality')
    .select('*')
    .eq('job_id', jobId);

  const { data: links } = await db
    .from('keyword_cluster_links')
    .select('*')
    .eq('job_id', jobId);

  const spokesByCluster = new Map<string, typeof spokes>();
  for (const spoke of spokes ?? []) {
    const clusterId = spoke.cluster_id as string;
    const list = spokesByCluster.get(clusterId) ?? [];
    list.push(spoke);
    spokesByCluster.set(clusterId, list);
  }

  return {
    job,
    clusters: (clusters ?? []).map((cluster: Record<string, unknown>) => ({
      ...cluster,
      spokes: spokesByCluster.get(cluster.id as string) ?? [],
    })),
    qualityGates: quality ?? [],
    links: links ?? [],
  };
}

export async function loadKeywordsForExport(jobId: string) {
  const db = ranklyAdmin();

  const { data, error } = await db
    .from('keyword_cluster_keywords')
    .select('keyword, volume, kd, cpc, intent, role, cluster_id')
    .eq('job_id', jobId)
    .order('keyword', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const clusterIds = [
    ...new Set(
      (data ?? [])
        .map((row: { cluster_id: string | null }) => row.cluster_id)
        .filter(Boolean),
    ),
  ] as string[];

  const clusterNames = new Map<string, string>();
  if (clusterIds.length) {
    const { data: clusters } = await db
      .from('keyword_clusters')
      .select('id, name')
      .in('id', clusterIds);

    for (const cluster of clusters ?? []) {
      clusterNames.set(cluster.id as string, cluster.name as string);
    }
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    keyword: row.keyword as string,
    volume: row.volume as number | null,
    kd: row.kd as number | null,
    cpc: row.cpc as number | null,
    intent: row.intent as string | null,
    cluster_name: row.cluster_id
      ? (clusterNames.get(row.cluster_id as string) ?? '')
      : '',
    role: row.role as string | null,
  }));
}
