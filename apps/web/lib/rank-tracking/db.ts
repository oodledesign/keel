import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { projectCountryToCode } from '~/lib/site-overview/domain';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  computeNextRankCheckAt,
  estimateRankCheckCostUsd,
  type KeywordRankSnapshot,
  type RankCheckJobRow,
  type RankRefreshInterval,
  type RankTrackingSettings,
} from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

function ranklyClient() {
  return supabaseCustomSchema(getSupabaseServerClient(), 'rankly');
}

export async function getRankCheckJob(jobId: string): Promise<RankCheckJobRow> {
  const { data, error } = await ranklyAdmin()
    .from('rank_check_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Rank check job not found');
  }

  return data as RankCheckJobRow;
}

export async function updateRankCheckJob(
  jobId: string,
  patch: Partial<RankCheckJobRow>,
): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('rank_check_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function logDataForSeoUsage(input: {
  projectId: string;
  endpoint: string;
  taskCount: number;
  estimatedCostUsd: number;
  featureArea: string;
}): Promise<void> {
  await ranklyAdmin().from('dataforseo_api_log').insert({
    project_id: input.projectId,
    endpoint: input.endpoint,
    task_count: input.taskCount,
    estimated_cost_usd: input.estimatedCostUsd,
    feature_area: input.featureArea,
  });
}

export async function loadRankTrackingSettings(
  projectId: string,
): Promise<RankTrackingSettings | null> {
  const { data: project, error } = await ranklyClient()
    .from('projects')
    .select(
      'rank_refresh_interval, track_desktop, track_mobile, target_country',
    )
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project) {
    return null;
  }

  const { data: cronState } = await ranklyClient()
    .from('project_cron_state')
    .select('last_rank_check_at, next_rank_check_at')
    .eq('project_id', projectId)
    .maybeSingle();

  return {
    rankRefreshInterval: (project.rank_refresh_interval ??
      'weekly') as RankRefreshInterval,
    trackDesktop: Boolean(project.track_desktop ?? true),
    trackMobile: Boolean(project.track_mobile ?? true),
    targetCountry: projectCountryToCode(String(project.target_country ?? 'gb')),
    lastRankCheckAt: cronState?.last_rank_check_at ?? null,
    nextRankCheckAt: cronState?.next_rank_check_at ?? null,
  };
}

export async function loadLatestRankCheckJob(
  projectId: string,
): Promise<RankCheckJobRow | null> {
  const { data } = await ranklyClient()
    .from('rank_check_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as RankCheckJobRow | null) ?? null;
}

export async function loadKeywordRankSnapshots(
  projectId: string,
  settings?: RankTrackingSettings | null,
): Promise<KeywordRankSnapshot[]> {
  const { data: keywords, error } = await ranklyClient()
    .from('keywords')
    .select('id, keyword, search_engine, device')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !keywords?.length) {
    return [];
  }

  const devices: string[] = [];
  if (settings?.trackDesktop ?? true) devices.push('desktop');
  if (settings?.trackMobile) devices.push('mobile');
  if (devices.length === 0) devices.push('desktop');

  const keywordIds = keywords.map((row) => row.id as string);
  const { data: rankings } = await ranklyClient()
    .from('keyword_rankings')
    .select('keyword_id, position, ranking_url, ai_overview_present, date, device')
    .in('keyword_id', keywordIds)
    .in('device', devices)
    .order('date', { ascending: false });

  const byKeywordDevice = new Map<
    string,
    Array<{
      position: number | null;
      ranking_url: string | null;
      ai_overview_present: boolean;
      date: string;
      device: string;
    }>
  >();

  for (const row of rankings ?? []) {
    const key = `${row.keyword_id as string}:${row.device as string}`;
    const list = byKeywordDevice.get(key) ?? [];
    list.push({
      position: row.position != null ? Number(row.position) : null,
      ranking_url: row.ranking_url as string | null,
      ai_overview_present: Boolean(row.ai_overview_present),
      date: String(row.date),
      device: String(row.device),
    });
    byKeywordDevice.set(key, list);
  }

  const snapshots: KeywordRankSnapshot[] = [];

  for (const keyword of keywords) {
    for (const device of devices) {
      const history = byKeywordDevice.get(`${keyword.id}:${device}`) ?? [];
      const latest = history[0];
      const previous = history[1];
      const position = latest?.position ?? null;
      const previousPosition = previous?.position ?? null;

      let positionChange: number | null = null;
      if (position != null && previousPosition != null) {
        positionChange = previousPosition - position;
      }

      snapshots.push({
        keywordId: keyword.id as string,
        keyword: String(keyword.keyword),
        searchEngine: String(keyword.search_engine),
        device,
        position,
        previousPosition,
        positionChange,
        rankingUrl: latest?.ranking_url ?? null,
        aiOverviewPresent: latest?.ai_overview_present ?? false,
        rankDate: latest?.date ?? null,
      });
    }
  }

  return snapshots;
}

export async function saveKeywordRankings(
  rows: Array<{
    keywordId: string;
    device: string;
    position: number | null;
    rankingUrl: string | null;
    aiOverviewPresent: boolean;
    serpFeatures: string[];
  }>,
  rankDate: string,
): Promise<void> {
  if (rows.length === 0) return;

  const db = ranklyAdmin();
  const payload = rows.map((row) => ({
    keyword_id: row.keywordId,
    date: rankDate,
    device: row.device,
    position: row.position,
    ranking_url: row.rankingUrl,
    ai_overview_present: row.aiOverviewPresent,
    serp_features: row.serpFeatures,
  }));

  const { error } = await db.from('keyword_rankings').upsert(payload, {
    onConflict: 'keyword_id,date,device',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function touchProjectRankSchedule(input: {
  projectId: string;
  interval: RankRefreshInterval;
  checkedAt?: Date;
}): Promise<void> {
  const checkedAt = input.checkedAt ?? new Date();
  const next = computeNextRankCheckAt(input.interval, checkedAt);

  await ranklyAdmin()
    .from('project_cron_state')
    .upsert(
      {
        project_id: input.projectId,
        last_rank_check_at: checkedAt.toISOString().slice(0, 10),
        next_rank_check_at: next?.toISOString() ?? null,
      },
      { onConflict: 'project_id' },
    );
}

export async function updateRankRefreshInterval(
  projectId: string,
  interval: RankRefreshInterval,
): Promise<void> {
  const next = computeNextRankCheckAt(interval);

  const { error: projectError } = await ranklyAdmin()
    .from('projects')
    .update({ rank_refresh_interval: interval })
    .eq('id', projectId);

  if (projectError) {
    throw new Error(projectError.message);
  }

  await ranklyAdmin()
    .from('project_cron_state')
    .upsert(
      {
        project_id: projectId,
        next_rank_check_at: next?.toISOString() ?? null,
      },
      { onConflict: 'project_id' },
    );
}

export async function updateRankTrackingDevices(
  projectId: string,
  input: { trackDesktop: boolean; trackMobile: boolean },
): Promise<void> {
  if (!input.trackDesktop && !input.trackMobile) {
    throw new Error('Enable at least one device for rank tracking');
  }

  const { error } = await ranklyAdmin()
    .from('projects')
    .update({
      track_desktop: input.trackDesktop,
      track_mobile: input.trackMobile,
    })
    .eq('id', projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export function countRankDevices(settings: RankTrackingSettings): number {
  let count = 0;
  if (settings.trackDesktop) count += 1;
  if (settings.trackMobile) count += 1;
  return count || 1;
}

export function estimateProjectRankCheckCost(
  keywordCount: number,
  settings: RankTrackingSettings,
): number {
  return estimateRankCheckCostUsd(keywordCount, countRankDevices(settings));
}

export async function loadProjectsDueForRankCheck(limit = 10): Promise<
  Array<{
    projectId: string;
    domain: string;
    targetCountry: string;
    trackDesktop: boolean;
    trackMobile: boolean;
    rankRefreshInterval: RankRefreshInterval;
  }>
> {
  const now = new Date().toISOString();

  const { data: cronRows } = await ranklyAdmin()
    .from('project_cron_state')
    .select('project_id, next_rank_check_at')
    .lte('next_rank_check_at', now)
    .order('next_rank_check_at', { ascending: true })
    .limit(limit * 3);

  const projectIds = (cronRows ?? []).map((row) => row.project_id as string);
  if (!projectIds.length) return [];

  const { data: projects } = await ranklyAdmin()
    .from('projects')
    .select(
      'id, domain, target_country, track_desktop, track_mobile, rank_refresh_interval',
    )
    .in('id', projectIds)
    .neq('rank_refresh_interval', 'manual');

  const due = (projects ?? [])
    .filter((project) => project.rank_refresh_interval !== 'manual')
    .slice(0, limit);

  return due.map((project) => ({
    projectId: project.id as string,
    domain: String(project.domain),
    targetCountry: projectCountryToCode(String(project.target_country ?? 'gb')),
    trackDesktop: Boolean(project.track_desktop ?? true),
    trackMobile: Boolean(project.track_mobile ?? false),
    rankRefreshInterval: project.rank_refresh_interval as RankRefreshInterval,
  }));
}
