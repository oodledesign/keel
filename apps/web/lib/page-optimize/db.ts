import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type { PageOptimizeAnalysis, PageOptimizeJobRow } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function getPageOptimizeJob(
  jobId: string,
): Promise<PageOptimizeJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('page_optimization_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Page optimization job not found');
  }

  return data as PageOptimizeJobRow;
}

export async function updatePageOptimizeJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('page_optimization_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update page optimization job: ${error.message}`);
  }
}

export async function savePageOptimizeReport(
  jobId: string,
  projectId: string,
  sourceUrl: string,
  targetKeyword: string,
  analysis: PageOptimizeAnalysis,
  snapshots: {
    page_snapshot: unknown;
    serp_snapshot: unknown;
    competitor_data: unknown;
  },
): Promise<string> {
  const { data, error } = await ranklyAdmin()
    .from('page_optimization_reports')
    .insert({
      job_id: jobId,
      project_id: projectId,
      source_url: sourceUrl,
      target_keyword: targetKeyword,
      page_snapshot: snapshots.page_snapshot,
      serp_snapshot: snapshots.serp_snapshot,
      competitor_data: snapshots.competitor_data,
      score: analysis.score,
      recommendations: analysis.recommendations,
      title_suggestions: analysis.title_suggestions,
      meta_suggestion: analysis.meta_suggestion,
      rewrite_summary: analysis.rewrite_summary,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? 'Failed to save page optimization report',
    );
  }

  return data.id as string;
}

export async function loadPageOptimizeReportByJobId(jobId: string) {
  const { data, error } = await ranklyAdmin()
    .from('page_optimization_reports')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
