import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type {
  AuditJobRow,
  AuditRecommendationRow,
  AuditReportRow,
  CompetingBrandOpr,
  CrawlResult,
  PlatformCitationResult,
  ReferringDomainRow,
  ScorerOutput,
  ScoreHistoryRow,
} from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function getAuditJob(jobId: string): Promise<AuditJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('ai_audit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Audit job not found');
  }

  return data as AuditJobRow;
}

export async function updateAuditJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('ai_audit_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update audit job: ${error.message}`);
  }
}

export async function saveAuditReport(
  jobId: string,
  projectId: string,
  domain: string,
  result: ScorerOutput,
  crawlData: CrawlResult,
  aiCitation: {
    domainCitedInAny: boolean;
    citedQueries: string[];
    competingBrands: string[];
    competingBrandsOpr: CompetingBrandOpr[];
    platforms: PlatformCitationResult[];
    oprScore: number;
    oprDecimal: number;
    referringDomains: number | null;
    topReferringDomains: ReferringDomainRow[];
    competitorBacklinks: Record<string, number>;
  },
): Promise<string> {
  const db = ranklyAdmin();

  const { data: report, error } = await db
    .from('ai_audit_reports')
    .insert({
      job_id: jobId,
      project_id: projectId,
      target_domain: domain,
      score_entity: result.score_entity,
      score_content: result.score_content,
      score_eeat: result.score_eeat,
      score_tech: result.score_tech,
      overall_score: result.overall_score,
      executive_summary: result.executive_summary,
      ai_cited: aiCitation.domainCitedInAny,
      ai_cited_queries: aiCitation.citedQueries,
      ai_competing_brands: aiCitation.competingBrands,
      ai_competing_brands_opr: aiCitation.competingBrandsOpr,
      ai_citations_by_platform: aiCitation.platforms,
      opr_score: aiCitation.oprScore,
      opr_decimal: aiCitation.oprDecimal,
      referring_domains: aiCitation.referringDomains,
      top_referring_domains: aiCitation.topReferringDomains,
      competitor_backlinks: aiCitation.competitorBacklinks,
      crawl_data: crawlData,
    })
    .select('id')
    .single();

  if (error || !report) {
    throw new Error(error?.message ?? 'Failed to save audit report');
  }

  const reportId = report.id as string;

  if (result.recommendations.length) {
    const { error: recError } = await db.from('ai_audit_recommendations').insert(
      result.recommendations.map((rec, index) => ({
        report_id: reportId,
        project_id: projectId,
        dimension: rec.dimension,
        priority: rec.priority,
        is_quick_win: rec.is_quick_win,
        title: rec.title,
        description: rec.description,
        outcome: rec.outcome,
        why: rec.why,
        magnitude: rec.magnitude,
        example_urls: rec.example_urls,
        display_order: index,
      })),
    );

    if (recError) {
      throw new Error(`Failed to save recommendations: ${recError.message}`);
    }
  }

  await db.from('ai_audit_score_history').insert({
    project_id: projectId,
    report_id: reportId,
    score_entity: result.score_entity,
    score_content: result.score_content,
    score_eeat: result.score_eeat,
    score_tech: result.score_tech,
    overall_score: result.overall_score,
  });

  return reportId;
}

export async function loadAuditReportBundle(
  reportId: string,
  userId: string,
): Promise<{
  report: AuditReportRow;
  recommendations: AuditRecommendationRow[];
} | null> {
  const db = ranklyAdmin();

  const { data: report, error } = await db
    .from('ai_audit_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (error || !report) return null;

  const { data: job } = await db
    .from('ai_audit_jobs')
    .select('user_id')
    .eq('id', report.job_id)
    .maybeSingle();

  if (!job || job.user_id !== userId) return null;

  const { data: recommendations } = await db
    .from('ai_audit_recommendations')
    .select('*')
    .eq('report_id', reportId)
    .order('display_order', { ascending: true });

  return {
    report: report as AuditReportRow,
    recommendations: (recommendations ?? []) as AuditRecommendationRow[],
  };
}

export async function loadLatestAuditForProject(
  projectId: string,
  userId: string,
): Promise<{
  report: AuditReportRow;
  recommendations: AuditRecommendationRow[];
  job: AuditJobRow;
} | null> {
  const db = ranklyAdmin();

  const { data: job } = await db
    .from('ai_audit_jobs')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return null;

  const { data: report } = await db
    .from('ai_audit_reports')
    .select('*')
    .eq('job_id', job.id)
    .maybeSingle();

  if (!report) return null;

  const { data: recommendations } = await db
    .from('ai_audit_recommendations')
    .select('*')
    .eq('report_id', report.id)
    .order('display_order', { ascending: true });

  return {
    job: job as AuditJobRow,
    report: report as AuditReportRow,
    recommendations: (recommendations ?? []) as AuditRecommendationRow[],
  };
}

export async function loadAuditReportsForProject(
  projectId: string,
  userId: string,
): Promise<
  Array<{
    id: string;
    target_domain: string;
    overall_score: number | null;
    created_at: string;
  }>
> {
  const db = ranklyAdmin();

  const { data: jobs } = await db
    .from('ai_audit_jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);
  if (!jobIds.length) return [];

  const { data } = await db
    .from('ai_audit_reports')
    .select('id, target_domain, overall_score, created_at')
    .in(
      'job_id',
      jobIds,
    )
    .order('created_at', { ascending: false });

  return (data ?? []) as Array<{
    id: string;
    target_domain: string;
    overall_score: number | null;
    created_at: string;
  }>;
}

export async function loadScoreHistory(
  projectId: string,
  userId: string,
): Promise<ScoreHistoryRow[]> {
  const db = ranklyAdmin();

  const { data: jobs } = await db
    .from('ai_audit_jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (!jobs?.length) return [];

  const { data } = await db
    .from('ai_audit_score_history')
    .select('*')
    .eq('project_id', projectId)
    .order('run_at', { ascending: true });

  return (data ?? []) as ScoreHistoryRow[];
}

export async function getRecommendationForUser(
  recommendationId: string,
  userId: string,
) {
  const db = ranklyAdmin();

  const { data: rec } = await db
    .from('ai_audit_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .maybeSingle();

  if (!rec) return null;

  const { data: report } = await db
    .from('ai_audit_reports')
    .select('job_id')
    .eq('id', rec.report_id)
    .maybeSingle();

  if (!report) return null;

  const { data: job } = await db
    .from('ai_audit_jobs')
    .select('user_id')
    .eq('id', report.job_id)
    .maybeSingle();

  if (!job || job.user_id !== userId) return null;

  return rec as AuditRecommendationRow;
}

export async function updateRecommendationSnippet(
  recommendationId: string,
  snippet: string,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('ai_audit_recommendations')
    .update({ fix_snippet: snippet })
    .eq('id', recommendationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadReportByJobId(jobId: string): Promise<{
  reportId: string;
  report: AuditReportRow;
} | null> {
  const { data, error } = await ranklyAdmin()
    .from('ai_audit_reports')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    reportId: data.id as string,
    report: data as AuditReportRow,
  };
}
