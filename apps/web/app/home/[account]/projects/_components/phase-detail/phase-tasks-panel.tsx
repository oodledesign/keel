'use client';

import { useCallback, useState, useTransition } from 'react';

import { Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '../../_lib/error-message';
import type { JobBoardTask } from '../../_lib/schema/project-phases.schema';
import {
  createJobTask,
  deleteJobTask,
  updateJobTask,
} from '../../_lib/server/server-actions';
import { AddProjectTaskForm } from '../job-project/add-project-task-form';
import {
  PRIORITY_DOT,
  TASK_STATUS_LABELS,
  formatShortDate,
  toDateInputValue,
} from '../job-project/job-project.constants';

const TASK_STATUSES = [
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
] as const;

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function PhaseTasksPanel({
  accountId,
  accountSlug,
  jobId,
  phaseId,
  initialTasks,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  phaseId: string;
  initialTasks: JobBoardTask[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingDelete, setPendingDelete] = useState<JobBoardTask | null>(null);
  const [, startTransition] = useTransition();

  const patchTask = useCallback(
    (task: JobBoardTask, updates: Partial<JobBoardTask>) => {
      const optimistic = { ...task, ...updates };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)));
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
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? (saved as JobBoardTask) : t)),
          );
        } catch (err) {
          toast.error(getErrorMessage(err));
          setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        }
      });
    },
    [accountId, accountSlug, jobId, startTransition],
  );

  const addTask = (title: string, subtaskTitles: string[]) => {
    startTransition(async () => {
      try {
        const task = await createJobTask({
          accountId,
          accountSlug,
          jobId,
          phaseId,
          title,
          priority: 'medium',
          subtaskTitles,
        });
        const created = task as JobBoardTask;
        setTasks((prev) => [...prev, created, ...(created.subtasks ?? [])]);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  const removeTask = (task: JobBoardTask) => {
    startTransition(async () => {
      try {
        await deleteJobTask({
          accountId,
          accountSlug,
          jobId,
          taskId: task.id,
        });
        setTasks((prev) =>
          prev.filter(
            (item) => item.id !== task.id && item.parent_task_id !== task.id,
          ),
        );
        setPendingDelete(null);
        toast.success('Task deleted');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  const rootTasks = tasks.filter((task) => !task.parent_task_id);
  const childTasks = (parentId: string) =>
    tasks.filter((task) => task.parent_task_id === parentId);

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Tasks
      </h2>
      <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
        {rootTasks.length} in this phase
      </p>

      <div className="mt-3 space-y-2">
        {rootTasks.length === 0 && (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No tasks yet.
          </p>
        )}
        {rootTasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/40 p-2.5"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.none}`}
              />
              {canEdit ? (
                <Input
                  defaultValue={task.title}
                  className="h-8 flex-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
                  onBlur={(e) => {
                    const title = e.target.value.trim();
                    if (title && title !== task.title)
                      patchTask(task, { title });
                  }}
                />
              ) : (
                <span className="flex-1 text-sm text-[var(--workspace-shell-text)]">
                  {task.title}
                </span>
              )}
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 p-0 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => setPendingDelete(task)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {canEdit ? (
                <>
                  <Select
                    value={task.status}
                    onValueChange={(status) => patchTask(task, { status })}
                  >
                    <SelectTrigger className="h-7 w-[130px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)]">
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
                  <Input
                    type="date"
                    defaultValue={toDateInputValue(task.due_date)}
                    className="h-7 w-[130px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)]"
                    onBlur={(e) => {
                      const val = e.target.value || null;
                      if (val !== toDateInputValue(task.due_date)) {
                        patchTask(task, { due_date: val });
                      }
                    }}
                  />
                </>
              ) : (
                <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {TASK_STATUS_LABELS[task.status] ?? task.status} ·{' '}
                  {formatShortDate(task.due_date)}
                </span>
              )}
            </div>
            {childTasks(task.id).length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-[color:var(--workspace-shell-border)]/60 pt-2">
                {childTasks(task.id).map((subtask) => (
                  <li
                    key={subtask.id}
                    className="flex items-center justify-between gap-2 pl-4 text-xs text-[var(--workspace-shell-text-muted)]"
                  >
                    <span>
                      {subtask.status === 'done' ? '✓ ' : '○ '}
                      {subtask.title}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="hover:text-red-400"
                        aria-label={`Delete ${subtask.title}`}
                        onClick={() => setPendingDelete(subtask)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-3">
          <AddProjectTaskForm onSubmit={addTask} />
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{pendingDelete?.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && childTasks(pendingDelete.id).length > 0
                ? `This will also delete ${childTasks(pendingDelete.id).length} subtask${childTasks(pendingDelete.id).length === 1 ? '' : 's'}. This can’t be undone.`
                : 'This can’t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-500"
              onClick={() => pendingDelete && removeTask(pendingDelete)}
            >
              Delete task
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
