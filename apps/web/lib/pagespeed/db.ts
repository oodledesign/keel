import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { computeNextRankCheckAt } from '~/lib/rank-tracking/types';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { projectDomainToHomepageUrl } from './domain';
import type {
  PagespeedCheckJobRow,
  PagespeedHistoryPoint,
  PagespeedMetricSet,
  PagespeedPageHistory,
  PagespeedPageRow,
  PagespeedRecommendation,
  PagespeedRefreshInterval,
  PagespeedResultRow,
  PagespeedSettings,
  PagespeedSnapshot,
  PagespeedStrategy,
  ParsedPagespeedResult,
} from './types';
import { DEFAULT_PAGESPEED_HISTORY_LIMIT } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

function ranklyClient() {
  return supabaseCustomSchema(getSupabaseServerClient(), 'rankly');
}

function mapResultRow(
  row: PagespeedResultRow,
  recommendations: PagespeedRecommendation[] = [],
): PagespeedMetricSet {
  return {
    resultId: row.id,
    performanceScore: row.performance_score,
    accessibilityScore: row.accessibility_score,
    bestPracticesScore: row.best_practices_score,
    seoScore: row.seo_score,
    lcpMs: row.lcp_ms != null ? Number(row.lcp_ms) : null,
    fcpMs: row.fcp_ms != null ? Number(row.fcp_ms) : null,
    cls: row.cls != null ? Number(row.cls) : null,
    tbtMs: row.tbt_ms != null ? Number(row.tbt_ms) : null,
    speedIndexMs:
      row.speed_index_ms != null ? Number(row.speed_index_ms) : null,
    fetchedAt: row.fetched_at,
    errorMsg: row.error_msg,
    recommendations,
  };
}

export async function ensureHomepagePage(input: {
  projectId: string;
  domain: string;
}): Promise<void> {
  const url = projectDomainToHomepageUrl(input.domain);

  const { data: existing } = await ranklyAdmin()
    .from('pagespeed_pages')
    .select('id, url')
    .eq('project_id', input.projectId)
    .eq('is_homepage', true)
    .maybeSingle();

  if (existing) {
    if (existing.url !== url) {
      await ranklyAdmin()
        .from('pagespeed_pages')
        .update({ url, label: 'Homepage' })
        .eq('id', existing.id as string);
    }
    return;
  }

  const { error } = await ranklyAdmin().from('pagespeed_pages').insert({
    project_id: input.projectId,
    url,
    label: 'Homepage',
    is_homepage: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadPagespeedPages(
  projectId: string,
): Promise<PagespeedPageRow[]> {
  const { data, error } = await ranklyClient()
    .from('pagespeed_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('is_homepage', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PagespeedPageRow[];
}

export async function loadPagespeedPagesAdmin(
  projectId: string,
): Promise<PagespeedPageRow[]> {
  const { data, error } = await ranklyAdmin()
    .from('pagespeed_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('is_homepage', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PagespeedPageRow[];
}

export async function loadLatestPagespeedResults(
  pageIds: string[],
): Promise<Map<string, PagespeedResultRow>> {
  if (pageIds.length === 0) return new Map();

  const { data, error } = await ranklyClient()
    .from('pagespeed_results')
    .select('*')
    .in('page_id', pageIds)
    .order('fetched_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, PagespeedResultRow>();
  for (const row of data ?? []) {
    const key = `${row.page_id as string}:${row.strategy as string}`;
    if (!latest.has(key)) {
      latest.set(key, row as PagespeedResultRow);
    }
  }

  return latest;
}

function mapHistoryPoint(row: PagespeedResultRow): PagespeedHistoryPoint {
  return {
    fetchedAt: row.fetched_at,
    performanceScore: row.performance_score,
    accessibilityScore: row.accessibility_score,
    bestPracticesScore: row.best_practices_score,
    seoScore: row.seo_score,
    lcpMs: row.lcp_ms != null ? Number(row.lcp_ms) : null,
    errorMsg: row.error_msg,
  };
}

export async function loadPagespeedPageForProject(
  projectId: string,
  pageId: string,
): Promise<PagespeedPageRow | null> {
  const { data, error } = await ranklyClient()
    .from('pagespeed_pages')
    .select('*')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PagespeedPageRow | null) ?? null;
}

function buildPageHistory(
  page: PagespeedPageRow,
  grouped: Map<string, PagespeedHistoryPoint[]>,
): PagespeedPageHistory {
  const mobile = grouped.get(`${page.id}:mobile`) ?? [];
  const desktop = grouped.get(`${page.id}:desktop`) ?? [];

  return {
    pageId: page.id,
    url: page.url,
    label: page.label,
    isHomepage: page.is_homepage,
    mobile: mobile.reverse(),
    desktop: desktop.reverse(),
  };
}

async function loadHistoryGroupedByPage(
  pageIds: string[],
  limitPerStrategy: number,
): Promise<Map<string, PagespeedHistoryPoint[]>> {
  if (pageIds.length === 0) return new Map();

  const { data, error } = await ranklyClient()
    .from('pagespeed_results')
    .select('*')
    .in('page_id', pageIds)
    .order('fetched_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, PagespeedHistoryPoint[]>();

  for (const raw of data ?? []) {
    const row = raw as PagespeedResultRow;
    const key = `${row.page_id}:${row.strategy}`;
    const bucket = grouped.get(key) ?? [];
    if (bucket.length >= limitPerStrategy) continue;
    bucket.push(mapHistoryPoint(row));
    grouped.set(key, bucket);
  }

  return grouped;
}

export async function loadPagespeedPageHistory(
  projectId: string,
  pageId: string,
  limitPerStrategy = DEFAULT_PAGESPEED_HISTORY_LIMIT,
): Promise<PagespeedPageHistory | null> {
  const page = await loadPagespeedPageForProject(projectId, pageId);
  if (!page) return null;

  const grouped = await loadHistoryGroupedByPage([pageId], limitPerStrategy);
  return buildPageHistory(page, grouped);
}

export async function loadPagespeedPageSnapshot(
  projectId: string,
  pageId: string,
): Promise<PagespeedSnapshot | null> {
  const page = await loadPagespeedPageForProject(projectId, pageId);
  if (!page) return null;

  const latest = await loadLatestPagespeedResults([pageId]);
  const mobile = latest.get(`${pageId}:mobile`);
  const desktop = latest.get(`${pageId}:desktop`);
  const resultIds = [mobile?.id, desktop?.id].filter(Boolean) as string[];
  const recommendationsByResult = await loadPagespeedRecommendations(resultIds);

  return {
    pageId: page.id,
    url: page.url,
    label: page.label,
    isHomepage: page.is_homepage,
    lastScannedAt: latestFetchedAt(mobile, desktop),
    mobile: mobile
      ? mapResultRow(mobile, recommendationsByResult.get(mobile.id) ?? [])
      : null,
    desktop: desktop
      ? mapResultRow(desktop, recommendationsByResult.get(desktop.id) ?? [])
      : null,
  };
}

export async function loadPagespeedHistory(
  projectId: string,
  limitPerStrategy = DEFAULT_PAGESPEED_HISTORY_LIMIT,
): Promise<PagespeedPageHistory[]> {
  await ensureHomepageForProject(projectId);

  const pages = await loadPagespeedPages(projectId);
  const pageIds = pages.map((page) => page.id);
  if (pageIds.length === 0) return [];

  const grouped = await loadHistoryGroupedByPage(pageIds, limitPerStrategy);
  return pages.map((page) => buildPageHistory(page, grouped));
}

function isMissingPagespeedRecommendationsTable(error: {
  message?: string;
  code?: string;
}) {
  const message = error.message ?? '';
  return (
    error.code === 'PGRST205' ||
    message.includes('pagespeed_recommendations') ||
    message.includes('schema cache')
  );
}

export async function loadPagespeedRecommendations(
  resultIds: string[],
): Promise<Map<string, PagespeedRecommendation[]>> {
  if (resultIds.length === 0) return new Map();

  const { data, error } = await ranklyClient()
    .from('pagespeed_recommendations')
    .select('*')
    .in('result_id', resultIds)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingPagespeedRecommendationsTable(error)) {
      return new Map();
    }
    throw new Error(error.message);
  }

  const grouped = new Map<string, PagespeedRecommendation[]>();

  for (const row of data ?? []) {
    const resultId = row.result_id as string;
    const list = grouped.get(resultId) ?? [];
    list.push({
      auditId: row.audit_id as string,
      title: row.title as string,
      description: (row.description as string) ?? '',
      displayValue: (row.display_value as string | null) ?? null,
      savingsMs: row.savings_ms != null ? Number(row.savings_ms) : null,
      priority: row.priority as PagespeedRecommendation['priority'],
      kind: row.kind as PagespeedRecommendation['kind'],
      category: row.category as PagespeedRecommendation['category'],
      isQuickWin: Boolean(row.is_quick_win),
    });
    grouped.set(resultId, list);
  }

  return grouped;
}

function latestFetchedAt(
  mobile: PagespeedResultRow | undefined,
  desktop: PagespeedResultRow | undefined,
): string | null {
  const timestamps = [mobile?.fetched_at, desktop?.fetched_at]
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => !Number.isNaN(value));

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export async function loadPagespeedSnapshots(
  projectId: string,
): Promise<PagespeedSnapshot[]> {
  await ensureHomepageForProject(projectId);

  const pages = await loadPagespeedPages(projectId);
  const latest = await loadLatestPagespeedResults(pages.map((page) => page.id));
  const resultIds = [...latest.values()].map((row) => row.id);
  const recommendationsByResult = await loadPagespeedRecommendations(resultIds);

  return pages.map((page) => {
    const mobile = latest.get(`${page.id}:mobile`);
    const desktop = latest.get(`${page.id}:desktop`);

    return {
      pageId: page.id,
      url: page.url,
      label: page.label,
      isHomepage: page.is_homepage,
      lastScannedAt: latestFetchedAt(mobile, desktop),
      mobile: mobile
        ? mapResultRow(mobile, recommendationsByResult.get(mobile.id) ?? [])
        : null,
      desktop: desktop
        ? mapResultRow(desktop, recommendationsByResult.get(desktop.id) ?? [])
        : null,
    };
  });
}

async function ensureHomepageForProject(projectId: string): Promise<void> {
  const { data: project } = await ranklyAdmin()
    .from('projects')
    .select('domain')
    .eq('id', projectId)
    .maybeSingle();

  if (!project?.domain) return;

  await ensureHomepagePage({
    projectId,
    domain: String(project.domain),
  });
}

export async function loadPagespeedSettings(
  projectId: string,
): Promise<PagespeedSettings | null> {
  const { data: project, error } = await ranklyClient()
    .from('projects')
    .select('pagespeed_refresh_interval')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project) return null;

  const { data: cronState } = await ranklyClient()
    .from('project_cron_state')
    .select('last_pagespeed_check_at, next_pagespeed_check_at')
    .eq('project_id', projectId)
    .maybeSingle();

  return {
    refreshInterval: (project.pagespeed_refresh_interval ??
      'weekly') as PagespeedRefreshInterval,
    lastCheckAt: cronState?.last_pagespeed_check_at ?? null,
    nextCheckAt: cronState?.next_pagespeed_check_at ?? null,
  };
}

export async function updatePagespeedRefreshInterval(
  projectId: string,
  interval: PagespeedRefreshInterval,
): Promise<void> {
  const next = computeNextRankCheckAt(interval);

  const { error: projectError } = await ranklyAdmin()
    .from('projects')
    .update({ pagespeed_refresh_interval: interval })
    .eq('id', projectId);

  if (projectError) {
    throw new Error(projectError.message);
  }

  await ranklyAdmin()
    .from('project_cron_state')
    .upsert(
      {
        project_id: projectId,
        next_pagespeed_check_at: next?.toISOString() ?? null,
      },
      { onConflict: 'project_id' },
    );
}

export async function touchPagespeedSchedule(input: {
  projectId: string;
  interval: PagespeedRefreshInterval;
  checkedAt?: Date;
}): Promise<void> {
  const checkedAt = input.checkedAt ?? new Date();
  const next = computeNextRankCheckAt(input.interval, checkedAt);

  await ranklyAdmin()
    .from('project_cron_state')
    .upsert(
      {
        project_id: input.projectId,
        last_pagespeed_check_at: checkedAt.toISOString(),
        next_pagespeed_check_at: next?.toISOString() ?? null,
      },
      { onConflict: 'project_id' },
    );
}

export async function getPagespeedCheckJob(
  jobId: string,
): Promise<PagespeedCheckJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('pagespeed_check_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'PageSpeed job not found');
  }

  return data as PagespeedCheckJobRow;
}

export async function updatePagespeedCheckJob(
  jobId: string,
  patch: Partial<PagespeedCheckJobRow>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('pagespeed_check_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadLatestPagespeedCheckJob(
  projectId: string,
): Promise<PagespeedCheckJobRow | null> {
  const { data, error } = await ranklyClient()
    .from('pagespeed_check_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PagespeedCheckJobRow | null) ?? null;
}

export async function savePagespeedResult(input: {
  pageId: string;
  strategy: PagespeedStrategy;
  metrics: ParsedPagespeedResult | null;
  recommendations?: PagespeedRecommendation[];
  errorMsg?: string | null;
}): Promise<string | null> {
  const payload = {
    page_id: input.pageId,
    strategy: input.strategy,
    performance_score: input.metrics?.performanceScore ?? null,
    accessibility_score: input.metrics?.accessibilityScore ?? null,
    best_practices_score: input.metrics?.bestPracticesScore ?? null,
    seo_score: input.metrics?.seoScore ?? null,
    lcp_ms: input.metrics?.lcpMs ?? null,
    fcp_ms: input.metrics?.fcpMs ?? null,
    cls: input.metrics?.cls ?? null,
    tbt_ms: input.metrics?.tbtMs ?? null,
    speed_index_ms: input.metrics?.speedIndexMs ?? null,
    error_msg: input.errorMsg ?? null,
    fetched_at: new Date().toISOString(),
  };

  const { data, error } = await ranklyAdmin()
    .from('pagespeed_results')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save PageSpeed result');
  }

  const resultId = data.id as string;

  if (input.recommendations?.length) {
    const rows = input.recommendations.map((rec, index) => ({
      result_id: resultId,
      audit_id: rec.auditId,
      title: rec.title,
      description: rec.description,
      display_value: rec.displayValue,
      savings_ms: rec.savingsMs,
      priority: rec.priority,
      kind: rec.kind,
      category: rec.category,
      is_quick_win: rec.isQuickWin,
      sort_order: index,
    }));

    const { error: recError } = await ranklyAdmin()
      .from('pagespeed_recommendations')
      .insert(rows);

    if (recError) {
      if (isMissingPagespeedRecommendationsTable(recError)) {
        return resultId;
      }
      throw new Error(recError.message);
    }
  }

  return resultId;
}

export async function loadProjectsDueForPagespeed(limit = 5): Promise<
  Array<{
    projectId: string;
    refreshInterval: PagespeedRefreshInterval;
  }>
> {
  const now = new Date().toISOString();

  const { data: cronRows } = await ranklyAdmin()
    .from('project_cron_state')
    .select('project_id, next_pagespeed_check_at')
    .lte('next_pagespeed_check_at', now)
    .order('next_pagespeed_check_at', { ascending: true })
    .limit(limit * 3);

  const projectIds = (cronRows ?? []).map((row) => row.project_id as string);
  if (!projectIds.length) return [];

  const { data: projects } = await ranklyAdmin()
    .from('projects')
    .select('id, pagespeed_refresh_interval')
    .in('id', projectIds)
    .neq('pagespeed_refresh_interval', 'manual');

  return (projects ?? []).slice(0, limit).map((project) => ({
    projectId: project.id as string,
    refreshInterval:
      project.pagespeed_refresh_interval as PagespeedRefreshInterval,
  }));
}

export async function countPagespeedPages(projectId: string): Promise<number> {
  const { count, error } = await ranklyAdmin()
    .from('pagespeed_pages')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function insertPagespeedPage(input: {
  projectId: string;
  url: string;
  label?: string | null;
  isHomepage?: boolean;
}): Promise<PagespeedPageRow> {
  const { data, error } = await ranklyAdmin()
    .from('pagespeed_pages')
    .insert({
      project_id: input.projectId,
      url: input.url,
      label: input.label ?? null,
      is_homepage: input.isHomepage ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to add page');
  }

  return data as PagespeedPageRow;
}

export async function deletePagespeedPage(pageId: string): Promise<void> {
  const { data: page } = await ranklyAdmin()
    .from('pagespeed_pages')
    .select('is_homepage')
    .eq('id', pageId)
    .maybeSingle();

  if (page?.is_homepage) {
    throw new Error('The homepage cannot be removed');
  }

  const { error } = await ranklyAdmin()
    .from('pagespeed_pages')
    .delete()
    .eq('id', pageId);

  if (error) {
    throw new Error(error.message);
  }
}

export type PagespeedTask = {
  pageId: string;
  url: string;
  strategy: PagespeedStrategy;
};

export function buildPagespeedTasks(
  pages: PagespeedPageRow[],
): PagespeedTask[] {
  const tasks: PagespeedTask[] = [];
  for (const page of pages) {
    for (const strategy of ['mobile', 'desktop'] as const) {
      tasks.push({
        pageId: page.id,
        url: page.url,
        strategy,
      });
    }
  }
  return tasks;
}
