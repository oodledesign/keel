import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type {
  CrawledPageResult,
  SiteCrawlIssueSummary,
  SiteCrawlJobRow,
  SiteCrawlPageRow,
} from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

function ranklyClient() {
  return supabaseCustomSchema(getSupabaseServerClient(), 'rankly');
}

function mapJobRow(row: Record<string, unknown>): SiteCrawlJobRow {
  return {
    ...(row as SiteCrawlJobRow),
    pending_urls: Array.isArray(row.pending_urls)
      ? (row.pending_urls as string[])
      : [],
    issue_summary: (row.issue_summary as SiteCrawlIssueSummary) ?? {},
    last_worker_trigger_at:
      (row.last_worker_trigger_at as string | null | undefined) ?? null,
  };
}

export async function getSiteCrawlJob(jobId: string): Promise<SiteCrawlJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('site_crawl_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Site crawl job not found');
  }

  return mapJobRow(data as Record<string, unknown>);
}

export async function updateSiteCrawlJob(
  jobId: string,
  patch: Partial<SiteCrawlJobRow>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('site_crawl_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadLatestSiteCrawlJob(
  projectId: string,
): Promise<SiteCrawlJobRow | null> {
  const { data } = await ranklyClient()
    .from('site_crawl_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapJobRow(data as Record<string, unknown>) : null;
}

export async function loadSiteCrawlPages(
  jobId: string,
  limit = 500,
): Promise<SiteCrawlPageRow[]> {
  const { data, error } = await ranklyClient()
    .from('site_crawl_pages')
    .select('*')
    .eq('job_id', jobId)
    .order('url', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SiteCrawlPageRow[];
}

export async function loadCrawledUrlsForJob(jobId: string): Promise<Set<string>> {
  const { data, error } = await ranklyAdmin()
    .from('site_crawl_pages')
    .select('url')
    .eq('job_id', jobId);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => String(row.url)));
}

export async function insertSiteCrawlPage(
  jobId: string,
  projectId: string,
  page: CrawledPageResult,
): Promise<void> {
  const { error } = await ranklyAdmin().from('site_crawl_pages').upsert(
    {
      job_id: jobId,
      project_id: projectId,
      url: page.url,
      final_url: page.finalUrl,
      status_code: page.statusCode,
      title: page.title,
      meta_description: page.metaDescription,
      h1: page.h1,
      h1_count: page.h1Count,
      canonical: page.canonical,
      word_count: page.wordCount,
      indexable: page.indexable,
      internal_links_out: page.internalLinksOut,
      external_links_out: page.externalLinksOut,
      issues: page.issues,
      crawl_error: page.crawlError,
    },
    { onConflict: 'job_id,url' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadAllPagesForJob(jobId: string): Promise<
  Array<{
    id: string;
    title: string;
    meta_description: string;
    issues: SiteCrawlPageRow['issues'];
  }>
> {
  const { data, error } = await ranklyAdmin()
    .from('site_crawl_pages')
    .select('id, title, meta_description, issues')
    .eq('job_id', jobId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    id: string;
    title: string;
    meta_description: string;
    issues: SiteCrawlPageRow['issues'];
  }>;
}

export async function updateSiteCrawlPageIssues(
  pageId: string,
  issues: SiteCrawlPageRow['issues'],
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('site_crawl_pages')
    .update({ issues })
    .eq('id', pageId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listActiveSiteCrawlJobs(
  limit = 5,
): Promise<SiteCrawlJobRow[]> {
  const { data, error } = await ranklyAdmin()
    .from('site_crawl_jobs')
    .select('*')
    .in('status', ['pending', 'running'])
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>));
}

export async function listStalledSiteCrawlJobs(
  stallMinutes: number,
  limit = 8,
): Promise<SiteCrawlJobRow[]> {
  const cutoff = new Date(Date.now() - stallMinutes * 60 * 1000).toISOString();

  const { data, error } = await ranklyAdmin()
    .from('site_crawl_jobs')
    .select('*')
    .in('status', ['pending', 'running'])
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => mapJobRow(row as Record<string, unknown>))
    .filter(
      (job) =>
        job.pending_urls.length > 0 || job.urls_crawled < job.url_limit,
    );
}

export async function loadSiteCrawlPagesForExport(
  jobId: string,
): Promise<SiteCrawlPageRow[]> {
  const { data, error } = await ranklyClient()
    .from('site_crawl_pages')
    .select('*')
    .eq('job_id', jobId)
    .order('url', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SiteCrawlPageRow[];
}
