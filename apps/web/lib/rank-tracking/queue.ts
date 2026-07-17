import 'server-only';

import { randomUUID } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { type RankTask, buildRankTasks } from './fetch-ranks';
import {
  RANK_TASKS_PER_INVOCATION,
  RANK_TASK_STALE_MINUTES,
} from './queue-config';

export type RankCheckTaskRow = {
  id: string;
  job_id: string;
  keyword_id: string;
  device: string;
  status: string;
  attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  error_msg: string | null;
};

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function releaseStaleRankCheckTasks(): Promise<number> {
  const { data, error } = await ranklyAdmin().rpc(
    'release_stale_rank_check_tasks',
    {
      p_stale_minutes: RANK_TASK_STALE_MINUTES,
    },
  );

  if (error) {
    console.error('[rankly] release_stale_rank_check_tasks', error.message);
    return 0;
  }

  return Number(data ?? 0);
}

export async function enqueueRankCheckTasks(
  jobId: string,
  tasks: RankTask[],
): Promise<number> {
  if (tasks.length === 0) return 0;

  const payload = tasks.map((task) => ({
    job_id: jobId,
    keyword_id: task.keywordId,
    device: task.device,
    status: 'pending' as const,
  }));

  const { error } = await ranklyAdmin()
    .from('rank_check_tasks')
    .upsert(payload, {
      onConflict: 'job_id,keyword_id,device',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { count } = await ranklyAdmin()
    .from('rank_check_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  return count ?? tasks.length;
}

export async function claimRankCheckTasks(
  jobId: string,
  limit: number = RANK_TASKS_PER_INVOCATION,
): Promise<RankCheckTaskRow[]> {
  const workerId = randomUUID().slice(0, 12);
  const { data, error } = await ranklyAdmin().rpc('claim_rank_check_tasks', {
    p_job_id: jobId,
    p_limit: limit,
    p_worker_id: workerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RankCheckTaskRow[];
}

export async function completeRankCheckTask(input: {
  taskId: string;
  status: 'done' | 'error';
  errorMsg?: string | null;
}): Promise<void> {
  const { error } = await ranklyAdmin()
    .from('rank_check_tasks')
    .update({
      status: input.status,
      error_msg: input.errorMsg ?? null,
      locked_at: null,
      locked_by: null,
    })
    .eq('id', input.taskId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelRankCheckJobTasks(jobId: string): Promise<number> {
  const { data, error } = await ranklyAdmin()
    .from('rank_check_tasks')
    .update({
      status: 'error',
      error_msg: 'Cancelled',
      locked_at: null,
      locked_by: null,
    })
    .eq('job_id', jobId)
    .in('status', ['pending', 'processing'])
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function countRankCheckTasksByStatus(
  jobId: string,
): Promise<{
  pending: number;
  processing: number;
  done: number;
  error: number;
  total: number;
}> {
  const { data, error } = await ranklyAdmin()
    .from('rank_check_tasks')
    .select('status')
    .eq('job_id', jobId);

  if (error) {
    throw new Error(error.message);
  }

  const counts = { pending: 0, processing: 0, done: 0, error: 0, total: 0 };
  for (const row of data ?? []) {
    const status = String(row.status);
    counts.total += 1;
    if (status === 'pending') counts.pending += 1;
    else if (status === 'processing') counts.processing += 1;
    else if (status === 'done') counts.done += 1;
    else if (status === 'error') counts.error += 1;
  }
  return counts;
}

export async function loadKeywordTextMap(
  keywordIds: string[],
): Promise<Map<string, string>> {
  if (keywordIds.length === 0) return new Map();

  const { data, error } = await ranklyAdmin()
    .from('keywords')
    .select('id, keyword')
    .in('id', keywordIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data ?? []).map((row) => [String(row.id), String(row.keyword)]),
  );
}

export async function findJobsNeedingWorker(
  limit: number,
): Promise<Array<{ jobId: string; pendingTasks: number }>> {
  const { data: jobs, error } = await ranklyAdmin()
    .from('rank_check_jobs')
    .select('id, status, updated_at')
    .in('status', ['pending', 'running'])
    .order('updated_at', { ascending: true })
    .limit(limit * 4);

  if (error || !jobs?.length) {
    return [];
  }

  const results: Array<{ jobId: string; pendingTasks: number }> = [];

  for (const job of jobs) {
    const jobId = job.id as string;
    const status = String(job.status);

    // Jobs still in `pending` have not enqueued tasks yet — the worker must run first.
    if (status === 'pending') {
      results.push({ jobId, pendingTasks: 1 });
      continue;
    }

    const { count } = await ranklyAdmin()
      .from('rank_check_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id as string)
      .eq('status', 'pending');

    const pendingTasks = count ?? 0;
    if (pendingTasks > 0) {
      results.push({ jobId, pendingTasks });
    }
  }

  return results.slice(0, limit);
}

export { buildRankTasks };
