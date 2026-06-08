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
import { fetchKeywordRanksBatch } from './fetch-ranks';
import {
  RANK_GLOBAL_MAX_ACTIVE_JOBS,
  RANK_JOB_STALE_MINUTES,
  RANK_TASKS_PER_INVOCATION,
} from './queue-config';
import {
  buildRankTasks,
  claimRankCheckTasks,
  completeRankCheckTask,
  countRankCheckTasksByStatus,
  enqueueRankCheckTasks,
  findJobsNeedingWorker,
  loadKeywordTextMap,
  releaseStaleRankCheckTasks,
} from './queue';
import { estimateRankCheckCostUsd } from './types';
import { triggerRankCheckRunDebounced } from './trigger-run';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

/** Sync job counters from the task queue without triggering workers. */
export async function syncRankCheckJobProgress(jobId: string): Promise<void> {
  await releaseStaleRankCheckTasks();

  const job = await getRankCheckJob(jobId);
  if (job.status === 'done' || job.status === 'error') {
    return;
  }

  const counts = await countRankCheckTasksByStatus(jobId);
  if (counts.total === 0) {
    return;
  }

  const tasksCompleted = counts.done + counts.error;
  const previousCompleted = job.tasks_completed;
  const previousUpdatedAt = job.updated_at;

  await updateRankCheckJob(jobId, {
    tasks_completed: tasksCompleted,
    tasks_total: counts.total,
  });

  const ageMs = Date.now() - new Date(previousUpdatedAt).getTime();
  const staleMs = RANK_JOB_STALE_MINUTES * 60 * 1000;
  const hasOutstanding = counts.pending + counts.processing > 0;

  if (
    ageMs > staleMs &&
    hasOutstanding &&
    tasksCompleted === previousCompleted
  ) {
    await updateRankCheckJob(jobId, {
      status: 'error',
      error_msg:
        'Rank check stalled. Try again — work continues in the background via the task queue.',
      finished_at: new Date().toISOString(),
    });
  }
}

export async function sweepRankCheckWorkers(): Promise<{
  triggered: number;
  jobIds: string[];
}> {
  await releaseStaleRankCheckTasks();

  const jobs = await findJobsNeedingWorker(RANK_GLOBAL_MAX_ACTIVE_JOBS);
  const triggeredIds: string[] = [];

  for (const { jobId } of jobs) {
    const triggered = await triggerRankCheckRunDebounced(jobId);
    if (triggered) {
      triggeredIds.push(jobId);
    }
  }

  return { triggered: triggeredIds.length, jobIds: triggeredIds };
}

export async function runRankCheckJob(
  jobId: string,
): Promise<{ completed: boolean }> {
  await releaseStaleRankCheckTasks();

  const job = await getRankCheckJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return { completed: true };
  }

  const baselineCostUsd = Number(job.api_cost_usd ?? 0);
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
    const trackMobile = Boolean(project.track_mobile ?? true);
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

    const tasksTotal = await enqueueRankCheckTasks(jobId, rankTasks);
    const estimatedCostUsd = estimateRankCheckCostUsd(
      keywords.length,
      deviceCount,
    );

    if (
      job.tasks_total !== tasksTotal ||
      job.keyword_count !== keywords.length
    ) {
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

    const claimed = await claimRankCheckTasks(
      jobId,
      RANK_TASKS_PER_INVOCATION,
    );

    if (claimed.length === 0) {
      const counts = await countRankCheckTasksByStatus(jobId);
      const hasOutstanding = counts.pending + counts.processing > 0;

      if (!hasOutstanding && counts.total > 0) {
        await finalizeRankCheckJob({
          jobId,
          projectId: job.project_id,
          rankRefreshInterval: (project.rank_refresh_interval ??
            'weekly') as 'manual' | 'daily' | 'weekly' | 'monthly',
          tasksCompleted: counts.done + counts.error,
          totalApiCostUsd: baselineCostUsd,
        });
        return { completed: true };
      }

      return { completed: !hasOutstanding };
    }

    const keywordTextById = await loadKeywordTextMap(
      claimed.map((task) => task.keyword_id),
    );

    let sessionApiCostUsd = 0;

    for (const task of claimed) {
      const keyword =
        keywordTextById.get(task.keyword_id) ??
        keywords.find((row) => row.id === task.keyword_id)?.keyword;

      if (!keyword) {
        await completeRankCheckTask({
          taskId: task.id,
          status: 'error',
          errorMsg: 'Keyword not found',
        });
        continue;
      }

      try {
        const { results, apiCostUsd } = await fetchKeywordRanksBatch({
          keywords: [String(keyword)],
          targetDomain: String(project.domain),
          countryCode,
          device: task.device as 'desktop' | 'mobile',
        });

        sessionApiCostUsd += apiCostUsd;

        if (results.length > 0) {
          await saveKeywordRankings(
            results.map((result) => ({
              keywordId: task.keyword_id,
              device: result.device,
              position: result.position,
              rankingUrl: result.rankingUrl,
              aiOverviewPresent: result.aiOverviewPresent,
              serpFeatures: result.serpFeatures,
            })),
            rankDate,
          );
        }

        await completeRankCheckTask({ taskId: task.id, status: 'done' });
      } catch (error) {
        await completeRankCheckTask({
          taskId: task.id,
          status: 'error',
          errorMsg:
            error instanceof Error ? error.message : 'SERP fetch failed',
        });
      }
    }

    const totalApiCostUsd = baselineCostUsd + sessionApiCostUsd;
    const counts = await countRankCheckTasksByStatus(jobId);

    await updateRankCheckJob(jobId, {
      tasks_completed: counts.done + counts.error,
      tasks_total: counts.total,
      api_cost_usd: totalApiCostUsd,
    });

    const hasPending = counts.pending + counts.processing > 0;

    if (hasPending) {
      await triggerRankCheckRunDebounced(jobId);
      return { completed: false };
    }

    await finalizeRankCheckJob({
      jobId,
      projectId: job.project_id,
      rankRefreshInterval: (project.rank_refresh_interval ??
        'weekly') as 'manual' | 'daily' | 'weekly' | 'monthly',
      tasksCompleted: counts.done + counts.error,
      totalApiCostUsd,
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

async function finalizeRankCheckJob(input: {
  jobId: string;
  projectId: string;
  rankRefreshInterval: 'manual' | 'daily' | 'weekly' | 'monthly';
  tasksCompleted: number;
  totalApiCostUsd: number;
}): Promise<void> {
  await logDataForSeoUsage({
    projectId: input.projectId,
    endpoint: '/serp/google/organic/live/advanced',
    taskCount: input.tasksCompleted,
    estimatedCostUsd: input.totalApiCostUsd,
    featureArea: 'rank_tracking',
  });

  await touchProjectRankSchedule({
    projectId: input.projectId,
    interval: input.rankRefreshInterval,
  });

  await updateRankCheckJob(input.jobId, {
    status: 'done',
    finished_at: new Date().toISOString(),
    tasks_completed: input.tasksCompleted,
    api_cost_usd: input.totalApiCostUsd,
  });
}
