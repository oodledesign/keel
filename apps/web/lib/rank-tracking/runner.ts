import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { projectCountryToCode } from '~/lib/site-overview/domain';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  countRankDevices,
  getRankCheckJob,
  logDataForSeoUsage,
  saveKeywordRankings,
  touchProjectRankSchedule,
  updateRankCheckJob,
} from './db';
import { buildRankTasks, fetchKeywordRanksFromTasks } from './fetch-ranks';
import {
  RUN_TIME_BUDGET_MS,
  triggerRankCheckRun,
} from './trigger-run';
import { estimateRankCheckCostUsd } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

const STALE_JOB_MS = 8 * 60 * 1000;
const NUDGE_JOB_MS = 45 * 1000;

export async function recoverStaleRankCheckJob(
  jobId: string,
): Promise<'recovered' | 'nudged' | 'unchanged'> {
  const job = await getRankCheckJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return 'unchanged';
  }

  const updatedAt = new Date(job.updated_at).getTime();
  const ageMs = Date.now() - updatedAt;

  if (
    ageMs > STALE_JOB_MS &&
    job.tasks_total > 0 &&
    job.tasks_completed < job.tasks_total
  ) {
    await updateRankCheckJob(jobId, {
      status: 'error',
      error_msg:
        'Rank check timed out. Try again — large keyword lists run in batches.',
      finished_at: new Date().toISOString(),
    });
    return 'recovered';
  }

  if (ageMs > NUDGE_JOB_MS) {
    triggerRankCheckRun(jobId);
    return 'nudged';
  }

  return 'unchanged';
}

export async function runRankCheckJob(
  jobId: string,
  options?: { timeBudgetMs?: number },
): Promise<{ completed: boolean }> {
  const job = await getRankCheckJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return { completed: true };
  }

  const timeBudgetMs = options?.timeBudgetMs ?? RUN_TIME_BUDGET_MS;
  const baselineCostUsd = Number(job.api_cost_usd ?? 0);
  const startIndex = Number(job.tasks_completed ?? 0);
  const rankDate = new Date().toISOString().slice(0, 10);

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
      .select('id, keyword')
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
      return { completed: true };
    }

    const trackDesktop = Boolean(project.track_desktop ?? true);
    const trackMobile = Boolean(project.track_mobile ?? false);
    const deviceCount = countRankDevices({
      rankRefreshInterval: (project.rank_refresh_interval ??
        'weekly') as 'manual' | 'daily' | 'weekly' | 'monthly',
      trackDesktop,
      trackMobile,
      targetCountry: projectCountryToCode(
        String(project.target_country ?? 'gb'),
      ),
      lastRankCheckAt: null,
      nextRankCheckAt: null,
    });

    const rankTasks = buildRankTasks({
      keywords: keywords.map((row) => ({
        id: row.id as string,
        keyword: String(row.keyword),
      })),
      trackDesktop,
      trackMobile,
    });

    const tasksTotal = rankTasks.length;
    const estimatedCostUsd = estimateRankCheckCostUsd(
      keywords.length,
      deviceCount,
    );

    if (job.tasks_total !== tasksTotal) {
      await updateRankCheckJob(jobId, {
        keyword_count: keywords.length,
        device_count: deviceCount,
        tasks_total: tasksTotal,
        estimated_cost_usd: estimatedCostUsd,
      });
    }

    const countryCode = projectCountryToCode(
      String(project.target_country ?? 'gb'),
    );

    const { tasksCompleted, sessionApiCostUsd, completed } =
      await fetchKeywordRanksFromTasks({
        tasks: rankTasks,
        startIndex,
        targetDomain: String(project.domain),
        countryCode,
        timeBudgetMs,
        onBatch: async (batch) => {
          if (batch.rows.length > 0) {
            await saveKeywordRankings(
              batch.rows.map((row) => ({
                keywordId: row.keywordId,
                device: row.device,
                position: row.position,
                rankingUrl: row.rankingUrl,
                aiOverviewPresent: row.aiOverviewPresent,
                serpFeatures: row.serpFeatures,
              })),
              rankDate,
            );
          }

          await updateRankCheckJob(jobId, {
            tasks_completed: batch.tasksCompleted,
            api_cost_usd: baselineCostUsd + batch.sessionApiCostUsd,
          });
        },
      });

    const totalApiCostUsd = baselineCostUsd + sessionApiCostUsd;

    if (!completed) {
      triggerRankCheckRun(jobId);
      return { completed: false };
    }

    await logDataForSeoUsage({
      projectId: job.project_id,
      endpoint: '/serp/google/organic/live/advanced',
      taskCount: tasksCompleted,
      estimatedCostUsd: totalApiCostUsd,
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
      api_cost_usd: totalApiCostUsd,
    });

    return { completed: true };
  } catch (error) {
    await updateRankCheckJob(jobId, {
      status: 'error',
      error_msg: error instanceof Error ? error.message : 'Rank check failed',
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
