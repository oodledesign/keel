'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  JobBoardTask,
} from '../../_lib/schema/project-phases.schema';
import { createJobTask, updateJobTask } from '../../_lib/server/server-actions';
import { AddProjectTaskForm } from './add-project-task-form';
import { JobProjectTaskSheet } from './job-project-task-sheet';
import {
  PRIORITY_DOT,
  PROGRESS_STATUS_COLOURS,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  UNPHASED_KEY,
  formatShortDate,
} from './job-project.constants';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

type ProgressStatus = (typeof STATUS_COLUMNS)[number]['key'];

type MemberLookup = Map<
  string,
  { name: string | null; email: string | null; picture_url?: string | null }
>;

type ContactLookup = Map<
  string,
  { name: string | null; email: string | null; picture_url?: string | null }
>;

function resolveTaskAssigneeLabel(
  task: JobBoardTask,
  memberLookup: MemberLookup,
  contactLookup: ContactLookup,
): string | null {
  if (task.assignee_contact_id) {
    const contact = contactLookup.get(task.assignee_contact_id);
    return contact?.name ?? contact?.email ?? 'Assigned contact';
  }
  if (task.user_id) {
    const member = memberLookup.get(task.user_id);
    return member?.name ?? member?.email ?? 'Assigned';
  }
  return null;
}

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

function ProgressTaskCard({
  task,
  memberLookup,
  contactLookup,
  canEditJobs,
  onOpen,
  onStatusChange,
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  contactLookup: ContactLookup;
  canEditJobs: boolean;
  onOpen: () => void;
  onStatusChange: (status: ProgressStatus) => void;
}) {
  const assigneeLabel = resolveTaskAssigneeLabel(
    task,
    memberLookup,
    contactLookup,
  );
  const priorityKey = task.priority || 'none';
  const status = normalizeStatus(task.status);
  const linkCount = task.links?.length ?? 0;
  const attachedNoteCount = task.note_refs?.length ?? 0;
  const hasNotes = Boolean(task.notes?.trim());
  const metaBits = [
    attachedNoteCount > 0
      ? `${attachedNoteCount} note${attachedNoteCount === 1 ? '' : 's'}`
      : null,
    hasNotes ? 'Scratch' : null,
    linkCount > 0 ? `${linkCount} link${linkCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80 p-3 shadow-sm transition-colors hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--workspace-shell-panel)]"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priorityKey] ?? PRIORITY_DOT.none}`}
          title={task.priority}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-[var(--workspace-shell-text)]">
            {task.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canEditJobs ? (
              <select
                className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase outline-none ${
                  TASK_STATUS_STYLES[status] ?? TASK_STATUS_STYLES.todo
                }`}
                value={status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onStatusChange(e.target.value as ProgressStatus);
                }}
                aria-label="Task status"
              >
                {STATUS_COLUMNS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {TASK_STATUS_LABELS[option.key] ?? option.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                  TASK_STATUS_STYLES[status] ?? TASK_STATUS_STYLES.todo
                }`}
              >
                {TASK_STATUS_LABELS[status] ?? status.replace('_', ' ')}
              </span>
            )}
            {task.due_date ? (
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                {formatShortDate(task.due_date)}
              </span>
            ) : null}
            {assigneeLabel ? (
              <span className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
                {assigneeLabel}
              </span>
            ) : null}
            {metaBits.length > 0 ? (
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                {metaBits.join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobProjectProgressBoard({
  accountSlug,
  accountId,
  jobId,
  board,
  canEditJobs,
  members,
  onBoardChange,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  board: JobBoardResult;
  canEditJobs: boolean;
  members: {
    user_id: string;
    name: string | null;
    email: string | null;
    picture_url?: string | null;
  }[];
  onBoardChange: (board: JobBoardResult) => void;
}) {
  const [, startTransition] = useTransition();
  const [selectedTask, setSelectedTask] = useState<JobBoardTask | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const allTasks = useMemo(() => flattenBoardTasks(board), [board]);
  const tasks = useMemo(
    () => allTasks.filter((task) => !task.parent_task_id),
    [allTasks],
  );

  const defaultPhaseId = board.phases[0]?.id ?? null;

  const memberLookup = useMemo(() => {
    const map: MemberLookup = new Map();
    for (const member of members) {
      map.set(member.user_id, member);
    }
    for (const assignee of board.assignees ?? []) {
      if (!map.has(assignee.user_id)) {
        map.set(assignee.user_id, assignee);
      }
    }
    return map;
  }, [board.assignees, members]);

  const contactLookup = useMemo(() => {
    const map: ContactLookup = new Map();
    for (const contact of board.contactAssignees ?? []) {
      map.set(contact.id, {
        name: contact.name,
        email: contact.email,
        picture_url: contact.picture_url ?? undefined,
      });
    }
    return map;
  }, [board.contactAssignees]);

  const phaseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const phase of board.phases ?? []) {
      map.set(phase.id, phase.name);
    }
    return map;
  }, [board.phases]);

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

  const handleAddTask = useCallback(
    (status: ProgressStatus, title: string, subtaskTitles: string[]) => {
      setAddingTask(true);
      startTransition(async () => {
        try {
          const task = await createJobTask({
            accountId,
            accountSlug,
            jobId,
            phaseId: defaultPhaseId,
            title,
            status,
            priority: 'medium',
            subtaskTitles,
          });
          const created = task as JobBoardTask;
          const key = created.phase_id ?? UNPHASED_KEY;
          const next = { ...board.tasksByPhase };
          next[key] = [
            ...(next[key] ?? []),
            created,
            ...(created.subtasks ?? []),
          ];
          onBoardChange({ ...board, tasksByPhase: next });
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setAddingTask(false);
        }
      });
    },
    [
      accountId,
      accountSlug,
      board,
      defaultPhaseId,
      jobId,
      onBoardChange,
      startTransition,
    ],
  );

  function openTask(task: JobBoardTask) {
    setSelectedTask(task);
    setTaskSheetOpen(true);
  }

  function handleTaskUpdated(updated: JobBoardTask) {
    const next: JobBoardResult = {
      ...board,
      tasksByPhase: Object.fromEntries(
        Object.entries(board.tasksByPhase ?? {}).map(([phaseId, list]) => [
          phaseId,
          (list ?? []).map((task) =>
            task.id === updated.id ? { ...task, ...updated } : task,
          ),
        ]),
      ),
    };
    onBoardChange(next);
    setSelectedTask(updated);
  }

  if (tasks.length === 0 && !canEditJobs) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-2">
        {STATUS_COLUMNS.map((col) => {
          const columnTasks = byStatus.get(col.key) ?? [];
          const colour = PROGRESS_STATUS_COLOURS[col.key] ?? '#64748B';
          return (
            <div
              key={col.key}
              className="flex h-full w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80"
              style={{ borderTopWidth: 3, borderTopColor: colour }}
            >
              <div className="border-b border-[color:var(--workspace-shell-border)]/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    {col.label}
                  </h3>
                  <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text-muted)]">
                    {columnTasks.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                  {columnTasks.length === 0
                    ? 'No tasks'
                    : `${columnTasks.length} task${columnTasks.length === 1 ? '' : 's'}`}
                </p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-8 text-center text-xs text-[var(--workspace-shell-text-muted)]">
                    {canEditJobs
                      ? 'No tasks yet'
                      : 'Drop tasks here by changing status'}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <div key={task.id} className="space-y-1">
                      <ProgressTaskCard
                        task={task}
                        memberLookup={memberLookup}
                        contactLookup={contactLookup}
                        canEditJobs={canEditJobs}
                        onOpen={() => openTask(task)}
                        onStatusChange={(status) =>
                          moveTaskStatus(task, status)
                        }
                      />
                      {task.phase_id && phaseNameById.get(task.phase_id) ? (
                        <p className="px-1 text-[10px] text-[var(--workspace-shell-text-muted)]">
                          {phaseNameById.get(task.phase_id)}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {canEditJobs ? (
                <div className="border-t border-[color:var(--workspace-shell-border)]/80 p-2">
                  <AddProjectTaskForm
                    disabled={addingTask}
                    onSubmit={(title, subtaskTitles) =>
                      handleAddTask(col.key, title, subtaskTitles)
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <JobProjectTaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        task={selectedTask}
        accountId={accountId}
        accountSlug={accountSlug}
        jobId={jobId}
        canEditJobs={canEditJobs}
        onUpdated={handleTaskUpdated}
        subtasks={
          selectedTask
            ? allTasks.filter((item) => item.parent_task_id === selectedTask.id)
            : []
        }
        onSubtaskCreated={(subtask) => {
          const key = subtask.phase_id ?? UNPHASED_KEY;
          const next = { ...board.tasksByPhase };
          next[key] = [...(next[key] ?? []), subtask];
          onBoardChange({ ...board, tasksByPhase: next });
        }}
        onDeleted={(deleted) => {
          const next: Record<string, JobBoardTask[]> = {};
          for (const [key, list] of Object.entries(board.tasksByPhase)) {
            next[key] = (list ?? []).filter(
              (item) =>
                item.id !== deleted.id && item.parent_task_id !== deleted.id,
            );
          }
          onBoardChange({ ...board, tasksByPhase: next });
          setSelectedTask(null);
        }}
      />
    </div>
  );
}
