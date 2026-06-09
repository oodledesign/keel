import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type { BriefJobRow, BriefOutput, ContentBriefRow } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function getBriefJob(jobId: string): Promise<BriefJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('content_brief_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Brief job not found');
  }

  return data as BriefJobRow;
}

export async function updateBriefJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('content_brief_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update brief job: ${error.message}`);
  }
}

export async function saveBrief(
  jobId: string,
  projectId: string,
  targetKeyword: string,
  brief: BriefOutput,
  extras: {
    serp_snapshot: unknown;
    competitor_data: unknown;
    competitor_domains: unknown;
    target_referring_domains: number | null;
    competitor_backlinks: unknown;
    domain_keywords: unknown;
  },
): Promise<string> {
  const { data, error } = await ranklyAdmin()
    .from('content_briefs')
    .insert({
      job_id: jobId,
      project_id: projectId,
      target_keyword: targetKeyword,
      primary_keyword: brief.primary_keyword,
      secondary_keywords: brief.secondary_keywords,
      template_type: brief.template_type,
      template_rationale: brief.template_rationale,
      title_options: brief.title_options,
      suggested_meta_desc: brief.suggested_meta_desc,
      h1: brief.h1,
      outline: brief.outline,
      content_gaps: brief.content_gaps,
      word_count_target: brief.word_count_target,
      word_count_min: brief.word_count_min,
      word_count_max: brief.word_count_max,
      competitor_avg_wc: brief.competitor_avg_wc,
      suggested_links: brief.suggested_links,
      ai_cited_brands: brief.ai_cited_brands,
      ai_search_actions: brief.ai_search_actions,
      traffic_position_1_3: brief.traffic_position_1_3,
      traffic_position_5: brief.traffic_position_5,
      serp_snapshot: extras.serp_snapshot,
      competitor_data: extras.competitor_data,
      competitor_domains: extras.competitor_domains,
      target_referring_domains: extras.target_referring_domains,
      competitor_backlinks: extras.competitor_backlinks,
      domain_keywords: extras.domain_keywords,
      tone_notes: brief.tone_notes,
      eeat_notes: brief.eeat_notes,
      angle: brief.angle,
      required_assets: brief.required_assets,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save brief');
  }

  return data.id as string;
}

export async function loadBriefForUser(
  briefId: string,
  userId: string,
): Promise<ContentBriefRow | null> {
  const db = ranklyAdmin();

  const { data: brief, error } = await db
    .from('content_briefs')
    .select('*')
    .eq('id', briefId)
    .maybeSingle();

  if (error || !brief) return null;

  const { data: job } = await db
    .from('content_brief_jobs')
    .select('user_id')
    .eq('id', brief.job_id)
    .maybeSingle();

  if (!job || job.user_id !== userId) return null;

  return brief as ContentBriefRow;
}

export async function loadBriefByJobId(jobId: string): Promise<ContentBriefRow | null> {
  const { data, error } = await ranklyAdmin()
    .from('content_briefs')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ContentBriefRow;
}

export async function listBriefsForProject(
  projectId: string,
  userId: string,
): Promise<
  Array<{
    id: string;
    target_keyword: string;
    template_type: string | null;
    created_at: string;
    job_id: string;
  }>
> {
  const db = ranklyAdmin();

  const { data: jobs } = await db
    .from('content_brief_jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);
  if (!jobIds.length) return [];

  const { data, error } = await db
    .from('content_briefs')
    .select('id, target_keyword, template_type, created_at, job_id')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as Array<{
    id: string;
    target_keyword: string;
    template_type: string | null;
    created_at: string;
    job_id: string;
  }>;
}
