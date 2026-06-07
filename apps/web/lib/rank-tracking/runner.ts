import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  countRankDevices,
  getRankCheckJob,
  loadRankTrackingSettings,
  logDataForSeoUsage,
  saveKeywordRankings,
  touchProjectRankSchedule,
  updateRankCheckJob,
} from './db';
import { fetchAllKeywordRanks } from './fetch-ranks';
import { estimateRankCheckCostUsd } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function runRankCheckJob(jobId: string): Promise<void> {
  const job = await getRankCheckJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return;
  }

  try {
    await updateRankCheckJob(jobId, {
      status: 'running',
      started_at: job.started_at ?? new Date().toISOString(),
    });

    const { data: project, error: projectError } = await ranklyAdmin()
      .from('projects')
      .select(
        'id, domain, target_country, track_desktop, track_mobile, rank_refresh_interval',
      )
      .eq('id', job.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const { data: keywords, error: keywordError } = await ranklyAdmin()
      .from('keywords')
      .select('id, keyword, device')
      .eq('project_id', job.project_id)
      .order('created_at', { ascending: true });

    if (keywordError) {
      throw new Error(keywordError.message);
    }

    if (!keywords?.length) {
      await updateRankCheckJob(jobId, {
        status: 'done',
        finished_at: new Date().toISOString(),
        keyword_count: 0,
        tasks_total: 0,
        tasks_completed: 0,
        api_cost_usd: 0,
      });
      return;
    }

    const settings = await loadRankTrackingSettings(job.project_id);
    const trackDesktop = settings?.trackDesktop ?? Boolean(project.track_desktop ?? true);
    const trackMobile = settings?.trackMobile ?? Boolean(project.track_mobile ?? false);
    const deviceCount = countRankDevices({
      rankRefreshInterval: 'weekly',
      trackDesktop,
      trackMobile,
      targetCountry: String(project.target_country ?? 'gb'),
      lastRankCheckAt: null,
      nextRankCheckAt: null,
    });

    const tasksTotal = keywords.length * deviceCount;
    const estimatedCostUsd = estimateRankCheckCostUsd(keywords.length, deviceCount);

    await updateRankCheckJob(jobId, {
      keyword_count: keywords.length,
      device_count: deviceCount,
      tasks_total: tasksTotal,
      estimated_cost_usd: estimatedCostUsd,
    });

    const countryCode = String(project.target_country ?? 'gb')
      .trim()
      .toLowerCase()
      .slice(0, 2);

    const { rows, apiCostUsd, tasksCompleted } = await fetchAllKeywordRanks({
      keywords: keywords.map((row) => ({
        id: row.id as string,
        keyword: String(row.keyword),
        device: String(row.device ?? 'desktop'),
      })),
      targetDomain: String(project.domain),
      countryCode: countryCode === 'uk' ? 'gb' : countryCode,
      trackDesktop,
      trackMobile,
      onBatch: async (progress) => {
        await updateRankCheckJob(jobId, {
          tasks_completed: progress.tasksCompleted,
          api_cost_usd: progress.apiCostUsd,
        });
      },
    });

    const rankDate = new Date().toISOString().slice(0, 10);

    await saveKeywordRankings(
      rows.map((row) => ({
        keywordId: row.keywordId,
        device: row.device,
        position: row.position,
        rankingUrl: row.rankingUrl,
        aiOverviewPresent: row.aiOverviewPresent,
        serpFeatures: row.serpFeatures,
      })),
      rankDate,
    );

    await logDataForSeoUsage({
      projectId: job.project_id,
      endpoint: '/serp/google/organic/live/advanced',
      taskCount: tasksCompleted,
      estimatedCostUsd: apiCostUsd,
      featureArea: 'rank_tracking',
    });

    await touchProjectRankSchedule({
      projectId: job.project_id,
      interval: (project.rank_refresh_interval ?? 'weekly') as
        | 'manual'
        | 'daily'
        | 'weekly'
        | 'monthly',
    });

    await updateRankCheckJob(jobId, {
      status: 'done',
      finished_at: new Date().toISOString(),
      tasks_completed: tasksCompleted,
      api_cost_usd: apiCostUsd,
    });
  } catch (error) {
    await updateRankCheckJob(jobId, {
      status: 'error',
      error_msg: error instanceof Error ? error.message : 'Rank check failed',
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
