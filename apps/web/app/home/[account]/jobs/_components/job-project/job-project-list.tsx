'use client';

import { useCallback, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  JobBoardTask,
  PhaseListItem,
} from '../../_lib/schema/project-phases.schema';
import { updateJobTask } from '../../_lib/server/server-actions';
import {
  PRIORITY_DOT,
  TASK_STATUS_LABELS,
  UNPHASED_KEY,
  formatShortDate,
  toDateInputValue,
} from './job-project.constants';

const TASK_STATUSES = [
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
] as const;

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

function phasePath(accountSlug: string, jobId: string, phaseId: string) {
  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId)
    .replace('[phaseId]', phaseId);
}

function TaskRow({
  task,
  accountSlug,
  accountId,
  jobId,
  canEditJobs,
  onTaskUpdated,
}: {
  task: JobBoardTask;
  accountSlug: string;
  accountId: string;
  jobId: string;
  canEditJobs: boolean;
  onTaskUpdated: (task: JobBoardTask) => void;
}) {
  const [, startTransition] = useTransition();

  const patch = useCallback(
    (updates: Partial<JobBoardTask>) => {
      const optimistic = { ...task, ...updates };
      onTaskUpdated(optimistic);
      startTransition(async () => {
        try {
          const saved = await updateJobTask({
            accountId,
            accountSlug,
            jobId,
            taskId: task.id,
            title: updates.title,
            status: updates.status as
              | (typeof TASK_STATUSES)[number]
              | undefined,
            priority: updates.priority as
              | (typeof PRIORITIES)[number]
              | undefined,
            dueDate:
              updates.due_date === undefined
                ? undefined
                : updates.due_date
                  ? new Date(`${updates.due_date}T12:00:00`)
                  : null,
          });
          onTaskUpdated(saved as JobBoardTask);
        } catch (err) {
          toast.error(getErrorMessage(err));
          onTaskUpdated(task);
        }
      });
    },
    [accountId, accountSlug, jobId, onTaskUpdated, startTransition, task],
  );

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-[color:var(--workspace-shell-border)]/80 py-3 sm:grid-cols-[1fr_140px_120px_100px] sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.none}`}
        />
        {canEditJobs ? (
          <Input
            defaultValue={task.title}
            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm text-[var(--workspace-shell-text)]"
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== task.title) patch({ title });
            }}
          />
        ) : (
          <span className="truncate text-sm text-[var(--workspace-shell-text)]">
            {task.title}
          </span>
        )}
      </div>

      <div>
        {canEditJobs ? (
          <Select
            value={task.status}
            onValueChange={(status) => patch({ status })}
          >
            <SelectTrigger className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs text-[var(--workspace-shell-text)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            {TASK_STATUS_LABELS[task.status] ?? task.status}
          </span>
        )}
      </div>

      <div>
        {canEditJobs ? (
          <Input
            type="date"
            defaultValue={toDateInputValue(task.due_date)}
            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs text-[var(--workspace-shell-text)]"
            onBlur={(e) => {
              const val = e.target.value || null;
              if (val !== toDateInputValue(task.due_date)) {
                patch({ due_date: val });
              }
            }}
          />
        ) : (
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            {formatShortDate(task.due_date)}
          </span>
        )}
      </div>

      <div>
        {canEditJobs ? (
          <Select
            value={task.priority}
            onValueChange={(priority) => patch({ priority })}
          >
            <SelectTrigger className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs text-[var(--workspace-shell-text)] capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-[var(--workspace-shell-text-muted)] capitalize">
            {task.priority}
          </span>
        )}
      </div>
    </div>
  );
}

function PhaseGroup({
  phase,
  tasks,
  accountSlug,
  accountId,
  jobId,
  canEditJobs,
  onTasksChange,
  defaultOpen,
}: {
  phase: PhaseListItem | null;
  tasks: JobBoardTask[];
  accountSlug: string;
  accountId: string;
  jobId: string;
  canEditJobs: boolean;
  onTasksChange: (phaseKey: string, tasks: JobBoardTask[]) => void;
  defaultOpen?: boolean;
}) {
  const phaseKey = phase?.id ?? UNPHASED_KEY;
  const [open, setOpen] = useState(defaultOpen ?? true);

  const handleTaskUpdated = useCallback(
    (updated: JobBoardTask) => {
      onTasksChange(
        phaseKey,
        tasks.map((t) => (t.id === updated.id ? updated : t)),
      );
    },
    [onTasksChange, phaseKey, tasks],
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-[color:var(--workspace-shell-border)]"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--workspace-control-surface)]/40">
        <div className="min-w-0">
          {phase ? (
            <Link
              href={phasePath(accountSlug, jobId, phase.id)}
              prefetch={false}
              className="text-sm font-semibold text-[var(--workspace-shell-text)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {phase.name}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
              Unassigned
            </span>
          )}
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {phase ? ` · ${phase.progressPct}% done` : ''}
          </p>
        </div>
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          {open ? 'Hide' : 'Show'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        <div className="hidden border-b border-[color:var(--workspace-shell-border)] pb-2 text-[10px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase sm:grid sm:grid-cols-[1fr_140px_120px_100px] sm:gap-3">
          <span>Task</span>
          <span>Status</span>
          <span>Due</span>
          <span>Priority</span>
        </div>
        {tasks.length === 0 ? (
          <p className="py-4 text-sm text-[var(--workspace-shell-text-muted)]">
            No tasks in this phase.
          </p>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              accountSlug={accountSlug}
              accountId={accountId}
              jobId={jobId}
              canEditJobs={canEditJobs}
              onTaskUpdated={handleTaskUpdated}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function JobProjectList({
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
  const handleTasksChange = useCallback(
    (phaseKey: string, tasks: JobBoardTask[]) => {
      onBoardChange({
        ...board,
        tasksByPhase: { ...board.tasksByPhase, [phaseKey]: tasks },
      });
    },
    [board, onBoardChange],
  );

  if (board.phases.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Add phases to group tasks in the list view.
      </p>
    );
  }

  const unphased = board.tasksByPhase[UNPHASED_KEY] ?? [];

  return (
    <div className="space-y-3">
      {board.phases.map((phase, index) => (
        <PhaseGroup
          key={phase.id}
          phase={phase}
          tasks={board.tasksByPhase[phase.id] ?? []}
          accountSlug={accountSlug}
          accountId={accountId}
          jobId={jobId}
          canEditJobs={canEditJobs}
          onTasksChange={handleTasksChange}
          defaultOpen={index === 0}
        />
      ))}
      {unphased.length > 0 && (
        <PhaseGroup
          phase={null}
          tasks={unphased}
          accountSlug={accountSlug}
          accountId={accountId}
          jobId={jobId}
          canEditJobs={canEditJobs}
          onTasksChange={handleTasksChange}
        />
      )}
    </div>
  );
}
