export const DURATION_WEIGHTED_COVERAGE = 0.8;

export type TaskProgressInput = {
  id: string;
  status: string;
  parent_task_id?: string | null;
  duration_minutes?: number | null;
};

export type TaskProgressResult = {
  progressPct: number;
  mode: 'duration' | 'count';
};

function isCancelled(status: string): boolean {
  return status === 'cancelled';
}

function isDone(status: string): boolean {
  return status === 'done';
}

function hasPositiveDuration(
  value: number | null | undefined,
): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Project/phase progress from leaf tasks only.
 *
 * A parent with children is ignored (children carry the work). A parent with
 * no children is a leaf. Cancelled tasks are excluded from the active set.
 *
 * When at least 80% of active leaves have `duration_minutes > 0`, progress is
 * weighted by those durations (leaves without duration are omitted).
 * Otherwise falls back to done/active leaf counts.
 */
export function computeTaskProgress(
  tasks: TaskProgressInput[],
): TaskProgressResult {
  const parentIdsWithChildren = new Set<string>();
  for (const task of tasks) {
    if (task.parent_task_id) {
      parentIdsWithChildren.add(task.parent_task_id);
    }
  }

  const leaves = tasks.filter((task) => !parentIdsWithChildren.has(task.id));
  const activeLeaves = leaves.filter((task) => !isCancelled(task.status));

  if (activeLeaves.length === 0) {
    return { progressPct: 0, mode: 'count' };
  }

  const withDuration = activeLeaves.filter(
    (task): task is TaskProgressInput & { duration_minutes: number } =>
      hasPositiveDuration(task.duration_minutes),
  );
  const coverage = withDuration.length / activeLeaves.length;

  if (withDuration.length > 0 && coverage >= DURATION_WEIGHTED_COVERAGE) {
    const totalDuration = withDuration.reduce(
      (sum, task) => sum + task.duration_minutes,
      0,
    );
    const doneDuration = withDuration.reduce((sum, task) => {
      return isDone(task.status) ? sum + task.duration_minutes : sum;
    }, 0);

    return {
      progressPct: Math.round((doneDuration / totalDuration) * 100),
      mode: 'duration',
    };
  }

  const doneCount = activeLeaves.filter((task) => isDone(task.status)).length;

  return {
    progressPct: Math.round((doneCount / activeLeaves.length) * 100),
    mode: 'count',
  };
}
