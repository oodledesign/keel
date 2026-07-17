'use client';

import { useCallback, useState, useTransition } from 'react';

import { Plus } from 'lucide-react';

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
import { createJobTask, updateJobTask } from '../../_lib/server/server-actions';
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
  const [draftTitle, setDraftTitle] = useState('');
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

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const task = await createJobTask({
          accountId,
          accountSlug,
          jobId,
          phaseId,
          title,
          priority: 'medium',
        });
        setTasks((prev) => [...prev, task as JobBoardTask]);
        setDraftTitle('');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Tasks
      </h2>
      <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
        {tasks.length} in this phase
      </p>

      <div className="mt-3 space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No tasks yet.
          </p>
        )}
        {tasks.map((task) => (
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
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={addTask} className="mt-3 flex gap-1">
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Add task…"
            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
            disabled={!draftTitle.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}
    </section>
  );
}
