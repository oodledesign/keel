'use client';

import { useMemo, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  JobBoardTask,
} from '../../_lib/schema/project-phases.schema';
import { updateJobTask } from '../../_lib/server/server-actions';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

type ProgressStatus = (typeof STATUS_COLUMNS)[number]['key'];

function normalizeStatus(status: string): ProgressStatus {
  if (status === 'completed') return 'done';
  if (STATUS_COLUMNS.some((col) => col.key === status)) {
    return status as ProgressStatus;
  }
  return 'todo';
}

function flattenBoardTasks(board: JobBoardResult): JobBoardTask[] {
  const seen = new Set<string>();
  const tasks: JobBoardTask[] = [];
  for (const list of Object.values(board.tasksByPhase ?? {})) {
    for (const task of list ?? []) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      tasks.push(task);
    }
  }
  return tasks;
}

function patchTaskStatus(
  board: JobBoardResult,
  taskId: string,
  status: string,
): JobBoardResult {
  const tasksByPhase: JobBoardResult['tasksByPhase'] = {};
  for (const [phaseId, list] of Object.entries(board.tasksByPhase ?? {})) {
    tasksByPhase[phaseId] = (list ?? []).map((task) =>
      task.id === taskId ? { ...task, status } : task,
    );
  }
  return { ...board, tasksByPhase };
}

export function JobProjectProgressBoard({
  accountSlug,
  accountId,
  jobId,
  board,
  canEditJobs,
  onBoardChange,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  board: JobBoardResult;
  canEditJobs: boolean;
  onBoardChange: (board: JobBoardResult) => void;
}) {
  const [, startTransition] = useTransition();
  const tasks = useMemo(() => flattenBoardTasks(board), [board]);

  const byStatus = useMemo(() => {
    const map = new Map<string, JobBoardTask[]>();
    for (const col of STATUS_COLUMNS) map.set(col.key, []);
    for (const task of tasks) {
      map.get(normalizeStatus(task.status))?.push(task);
    }
    return map;
  }, [tasks]);

  function moveTaskStatus(task: JobBoardTask, nextStatus: ProgressStatus) {
    if (!canEditJobs || normalizeStatus(task.status) === nextStatus) return;

    const previous = board;
    onBoardChange(patchTaskStatus(board, task.id, nextStatus));

    startTransition(async () => {
      try {
        await updateJobTask({
          accountId,
          accountSlug,
          jobId,
          taskId: task.id,
          status: nextStatus,
        });
      } catch (error) {
        onBoardChange(previous);
        toast.error(getErrorMessage(error));
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No tasks yet. Switch to Phase board to organise work into phases.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_COLUMNS.map((col) => {
        const columnTasks = byStatus.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className="w-[280px] shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel-hover)]/40 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)] uppercase">
                {col.label}
              </p>
              <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {task.title}
                  </p>
                  {task.due_date ? (
                    <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      Due {task.due_date}
                    </p>
                  ) : null}
                  {canEditJobs ? (
                    <select
                      className="mt-2 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-1 text-xs text-[var(--workspace-shell-text)]"
                      value={normalizeStatus(task.status)}
                      onChange={(e) =>
                        moveTaskStatus(task, e.target.value as ProgressStatus)
                      }
                    >
                      {STATUS_COLUMNS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
