import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { delay } from '~/lib/clusters/utils';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { fetchPagespeedInsights } from './client';
import {
  type PagespeedTask,
  buildPagespeedTasks,
  getPagespeedCheckJob,
  loadPagespeedPagesAdmin,
  savePagespeedResult,
  touchPagespeedSchedule,
  updatePagespeedCheckJob,
} from './db';
import { RUN_TIME_BUDGET_MS, triggerPagespeedRun } from './trigger-run';
import type { PagespeedRefreshInterval } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

const STALE_JOB_MS = 8 * 60 * 1000;
const NUDGE_JOB_MS = 45 * 1000;
const PSI_DELAY_MS = 1500;

export async function recoverStalePagespeedJob(
  jobId: string,
): Promise<'recovered' | 'nudged' | 'unchanged'> {
  const job = await getPagespeedCheckJob(jobId);

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
    await updatePagespeedCheckJob(jobId, {
      status: 'error',
      error_msg:
        'PageSpeed check timed out. Try again — large page lists run in batches.',
      finished_at: new Date().toISOString(),
    });
    return 'recovered';
  }

  if (ageMs > NUDGE_JOB_MS) {
    triggerPagespeedRun(jobId);
    return 'nudged';
  }

  return 'unchanged';
}

async function runPagespeedTasks(input: {
  tasks: PagespeedTask[];
  startIndex: number;
  timeBudgetMs: number;
  onProgress: (tasksCompleted: number) => Promise<void>;
}): Promise<{ tasksCompleted: number; completed: boolean }> {
  const startTime = Date.now();
  let i = input.startIndex;

  while (i < input.tasks.length) {
    if (Date.now() - startTime > input.timeBudgetMs) {
      break;
    }

    const task = input.tasks[i];

    try {
      const response = await fetchPagespeedInsights({
        url: task.url,
        strategy: task.strategy,
      });
      await savePagespeedResult({
        pageId: task.pageId,
        strategy: task.strategy,
        metrics: response.metrics,
        recommendations: response.recommendations,
      });
    } catch (error) {
      await savePagespeedResult({
        pageId: task.pageId,
        strategy: task.strategy,
        metrics: null,
        errorMsg: error instanceof Error ? error.message : 'PageSpeed failed',
      });
    }

    i += 1;
    await input.onProgress(i);

    if (i < input.tasks.length) {
      await delay(PSI_DELAY_MS);
    }
  }

  return {
    tasksCompleted: i,
    completed: i >= input.tasks.length,
  };
}

export async function runPagespeedCheckJob(
  jobId: string,
  options?: { timeBudgetMs?: number },
): Promise<{ completed: boolean }> {
  const job = await getPagespeedCheckJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return { completed: true };
  }

  const timeBudgetMs = options?.timeBudgetMs ?? RUN_TIME_BUDGET_MS;
  const startIndex = Number(job.tasks_completed ?? 0);

  try {
    await updatePagespeedCheckJob(jobId, {
      status: 'running',
      started_at: job.started_at ?? new Date().toISOString(),
    });

    const pages = await loadPagespeedPagesAdmin(job.project_id);
    const tasks = buildPagespeedTasks(pages);

    if (tasks.length === 0) {
      await updatePagespeedCheckJob(jobId, {
        status: 'done',
        finished_at: new Date().toISOString(),
        tasks_total: 0,
        tasks_completed: 0,
      });
      return { completed: true };
    }

    if (job.tasks_total !== tasks.length) {
      await updatePagespeedCheckJob(jobId, { tasks_total: tasks.length });
    }

    const { tasksCompleted, completed } = await runPagespeedTasks({
      tasks,
      startIndex,
      timeBudgetMs,
      onProgress: async (done) => {
        await updatePagespeedCheckJob(jobId, { tasks_completed: done });
      },
    });

    if (!completed) {
      triggerPagespeedRun(jobId);
      return { completed: false };
    }

    const { data: projectRow } = await ranklyAdmin()
      .from('projects')
      .select('pagespeed_refresh_interval')
      .eq('id', job.project_id)
      .single();

    await touchPagespeedSchedule({
      projectId: job.project_id,
      interval: (projectRow?.pagespeed_refresh_interval ??
        'weekly') as PagespeedRefreshInterval,
    });

    await updatePagespeedCheckJob(jobId, {
      status: 'done',
      finished_at: new Date().toISOString(),
      tasks_completed: tasksCompleted,
    });

    return { completed: true };
  } catch (error) {
    await updatePagespeedCheckJob(jobId, {
      status: 'error',
      error_msg:
        error instanceof Error ? error.message : 'PageSpeed check failed',
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
