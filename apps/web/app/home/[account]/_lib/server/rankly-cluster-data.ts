import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export type ClusterJobSummary = {
  id: string;
  status: string;
  seeds: string[];
  country: string;
  credits_used: number | null;
  candidate_count: number | null;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
};

export const loadClusterJobsForProject = cache(
  async (
    projectId: string,
    userId: string,
  ): Promise<ClusterJobSummary[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keyword_cluster_jobs')
      .select(
        'id, status, seeds, country, credits_used, candidate_count, error_msg, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[rankly] cluster jobs', error.message);
      return [];
    }

    return (data ?? []) as ClusterJobSummary[];
  },
);

export const loadClusterJobBundleForUser = cache(
  async (jobId: string, userId: string) => {
    const client = getSupabaseServerClient();
    const db = supabaseCustomSchema(client, 'rankly');

    const { data: job, error: jobError } = await db
      .from('keyword_cluster_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (jobError || !job) {
      return null;
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

    const spokesByCluster = new Map<string, NonNullable<typeof spokes>>();
    for (const spoke of spokes ?? []) {
      const clusterId = spoke.cluster_id as string;
      const list = spokesByCluster.get(clusterId) ?? [];
      list.push(spoke);
      spokesByCluster.set(clusterId, list);
    }

    const clustersWithSpokes = (clusters ?? []).map(
      (cluster: Record<string, unknown>) => ({
        ...cluster,
        spokes: spokesByCluster.get(cluster.id as string) ?? [],
      }),
    );

    const clusterNameById = Object.fromEntries(
      clustersWithSpokes.map((cluster: Record<string, unknown>) => [
        cluster.id as string,
        cluster.name as string,
      ]),
    );

    return {
      job,
      clusters: clustersWithSpokes,
      qualityGates: quality ?? [],
      links: links ?? [],
      clusterNameById,
    };
  },
);
