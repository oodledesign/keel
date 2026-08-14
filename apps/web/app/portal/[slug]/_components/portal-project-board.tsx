'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Columns3, GanttChart, List, MessageSquare } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type {
  PortalProjectPhase,
  PortalProjectTask,
  PortalTaskComment,
} from '../_lib/server/client-portal.service';
import { addPortalTaskComment } from '../_lib/server/server-actions';
import { formatPortalDate } from './portal-badges';

type ViewMode = 'board' | 'timeline' | 'list';
type BoardMode = 'phase' | 'progress';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To do', colour: '#64748B' },
  { key: 'in_progress', label: 'In progress', colour: '#41606F' },
  { key: 'client_review', label: 'Review', colour: '#FF5C34' },
  { key: 'done', label: 'Done', colour: '#16A34A' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Review',
  done: 'Done',
  completed: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-[var(--workspace-shell-panel-hover)] text-[var(--ozer-text-on-light-muted)]',
  in_progress: 'bg-[var(--ozer-info)]/15 text-[var(--ozer-info)]',
  client_review:
    'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
  done: 'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
  cancelled:
    'bg-[var(--workspace-shell-panel-hover)] text-[var(--ozer-text-on-light-muted)]',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-[var(--ozer-text-on-light-muted)]',
  medium: 'bg-[var(--ozer-info)]',
  high: 'bg-[var(--ozer-gold-500,#F0C14B)]',
  urgent: 'bg-[var(--ozer-accent)]',
  none: 'bg-[var(--workspace-shell-panel-hover)]',
};

function TaskCardMeta({ task }: { task: PortalProjectTask }) {
  const status = normalizeStatus(task.status);
  const dueLabel = formatPortalDueLabel(task.dueDate);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
          STATUS_STYLES[status] ?? STATUS_STYLES.todo
        }`}
      >
        {STATUS_LABELS[status] ?? status.replace('_', ' ')}
      </span>
      {task.assigneeName ? (
        <span className="max-w-full truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
          {task.assigneeName}
        </span>
      ) : null}
      {dueLabel ? (
        <span className="text-[11px] text-[var(--ozer-text-on-light-muted)]">
          {dueLabel}
        </span>
      ) : null}
    </div>
  );
}

const PHASE_COLUMN_COLOURS = [
  '#41606F',
  '#8B5CF6',
  '#FF5C34',
  '#F0C14B',
  '#64748B',
  '#16A34A',
] as const;

function normalizeStatus(status: string) {
  if (status === 'completed') return 'done';
  if (STATUS_COLUMNS.some((col) => col.key === status)) return status;
  return 'todo';
}

function TaskComments({
  taskId,
  comments,
  drafts,
  setDrafts,
  pending,
  onSubmit,
  className,
}: {
  taskId: string;
  comments: PortalTaskComment[];
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {comments.length === 0 ? (
        <p className="text-xs text-[var(--ozer-text-on-light-muted)]">
          No comments yet
        </p>
      ) : null}
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-lg bg-[var(--workspace-shell-panel)] px-3 py-2"
        >
          <p className="text-xs font-medium text-[var(--ozer-text-on-light)]">
            {comment.authorName ?? 'Team'}{' '}
            <span className="font-normal text-[var(--ozer-text-on-light-muted)]">
              {formatPortalDate(comment.createdAt)}
            </span>
          </p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
            {comment.body}
          </p>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={drafts[taskId] ?? ''}
          onChange={(e) =>
            setDrafts((prev) => ({ ...prev, [taskId]: e.target.value }))
          }
          placeholder="Add a comment…"
          className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit(taskId);
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !(drafts[taskId] ?? '').trim()}
          onClick={() => onSubmit(taskId)}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

function formatPortalDueLabel(value: string | null | undefined) {
  if (parsePortalDueMs(value) == null) return null;
  return formatPortalDate(value);
}

function PortalProjectListView({
  tasks,
  commentsByTask,
  drafts,
  setDrafts,
  pending,
  onSubmit,
  expandedTaskId,
  setExpandedTaskId,
}: {
  tasks: PortalProjectTask[];
  commentsByTask: Map<string, PortalTaskComment[]>;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
}) {
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aMs = parsePortalDueMs(a.dueDate);
      const bMs = parsePortalDueMs(b.dueDate);
      if (aMs != null && bMs != null && aMs !== bMs) return aMs - bMs;
      if (aMs != null && bMs == null) return -1;
      if (aMs == null && bMs != null) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [tasks]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div
        className={cn(
          'hidden border-b border-[color:var(--workspace-shell-border)] px-3 py-2 text-[11px] font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase sm:grid sm:px-4',
          'sm:grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)_minmax(5.5rem,7rem)_minmax(5.5rem,7rem)_4.5rem]',
          'sm:gap-x-3',
        )}
      >
        <span>Task</span>
        <span>Assignee</span>
        <span>Status</span>
        <span>Due</span>
        <span className="text-right">Comments</span>
      </div>

      <ul>
        {sorted.map((task) => {
          const open = expandedTaskId === task.id;
          const status = normalizeStatus(task.status);
          const comments = commentsByTask.get(task.id) ?? [];
          const dueLabel = formatPortalDueLabel(task.dueDate);
          const priorityKey = task.priority || 'none';

          return (
            <li
              key={task.id}
              className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
            >
              <button
                type="button"
                className={cn(
                  'grid w-full items-center gap-x-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--workspace-shell-panel-hover)] sm:gap-x-3 sm:px-4',
                  'grid-cols-[minmax(0,1fr)_auto]',
                  'sm:grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)_minmax(5.5rem,7rem)_minmax(5.5rem,7rem)_4.5rem]',
                )}
                onClick={() => setExpandedTaskId(open ? null : task.id)}
                aria-expanded={open}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priorityKey] ?? PRIORITY_DOT.none}`}
                    title={task.priority ?? 'No priority'}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                          STATUS_STYLES[status] ?? STATUS_STYLES.todo
                        }`}
                      >
                        {STATUS_LABELS[status] ?? status.replace('_', ' ')}
                      </span>
                      {task.assigneeName ? (
                        <span className="truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                          {task.assigneeName}
                        </span>
                      ) : null}
                      {dueLabel ? (
                        <span className="text-[11px] text-[var(--ozer-text-on-light-muted)]">
                          {dueLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <span className="hidden truncate text-sm text-[var(--ozer-text-on-light-muted)] sm:block">
                  {task.assigneeName ?? '—'}
                </span>

                <span className="hidden sm:block">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.todo
                    }`}
                  >
                    {STATUS_LABELS[status] ?? status.replace('_', ' ')}
                  </span>
                </span>

                <span className="hidden text-sm text-[var(--ozer-text-on-light-muted)] sm:block">
                  {dueLabel ?? '—'}
                </span>

                <span className="inline-flex items-center justify-end gap-1 text-[11px] text-[var(--ozer-text-on-light-muted)]">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="tabular-nums">{comments.length}</span>
                </span>
              </button>

              {open ? (
                <div className="border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel-hover)]/40 px-3 py-3 sm:px-4">
                  <TaskComments
                    taskId={task.id}
                    comments={comments}
                    drafts={drafts}
                    setDrafts={setDrafts}
                    pending={pending}
                    onSubmit={onSubmit}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PortalProjectKanbanView({
  tasks,
  commentsByTask,
  drafts,
  setDrafts,
  pending,
  onSubmit,
  expandedTaskId,
  setExpandedTaskId,
}: {
  tasks: PortalProjectTask[];
  commentsByTask: Map<string, PortalTaskComment[]>;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
}) {
  const byStatus = useMemo(() => {
    const map = new Map<string, PortalProjectTask[]>();
    for (const col of STATUS_COLUMNS) map.set(col.key, []);
    for (const task of tasks) {
      map.get(normalizeStatus(task.status))?.push(task);
    }
    return map;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
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
            className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80"
            style={{ borderTopWidth: 3, borderTopColor: col.colour }}
          >
            <div className="border-b border-[color:var(--workspace-shell-border)]/80 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
                  {col.label}
                </h3>
                <span className="rounded-full bg-[var(--workspace-shell-panel-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--ozer-text-on-light-muted)]">
                  {columnTasks.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--ozer-text-on-light-muted)]">
                {columnTasks.length === 0
                  ? 'No tasks'
                  : `${columnTasks.length} task${columnTasks.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {columnTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-8 text-center text-xs text-[var(--ozer-text-on-light-muted)]">
                  No tasks in this stage
                </div>
              ) : (
                columnTasks.map((task) => {
                  const open = expandedTaskId === task.id;
                  const priorityKey = task.priority || 'none';
                  return (
                    <div
                      key={task.id}
                      className="rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)] p-3 shadow-sm"
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setExpandedTaskId(open ? null : task.id)}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priorityKey] ?? PRIORITY_DOT.none}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug font-medium text-[var(--ozer-text-on-light)]">
                              {task.title}
                            </p>
                            <TaskCardMeta task={task} />
                          </div>
                        </div>
                      </button>
                      {open ? (
                        <TaskComments
                          className="mt-3"
                          taskId={task.id}
                          comments={commentsByTask.get(task.id) ?? []}
                          drafts={drafts}
                          setDrafts={setDrafts}
                          pending={pending}
                          onSubmit={onSubmit}
                        />
                      ) : (
                        <p className="mt-2 pl-4 text-[11px] text-[var(--ozer-text-on-light-muted)]">
                          {(commentsByTask.get(task.id) ?? []).length} comment
                          {(commentsByTask.get(task.id) ?? []).length === 1
                            ? ''
                            : 's'}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parsePortalDueMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  // Prefer YYYY-MM-DD (date-only) to avoid UTC day-shift surprises.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (y < 2000) return null; // treat epoch / bogus legacy dates as undated
    const ms = Date.UTC(y, m - 1, d);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(trimmed).getTime();
  if (!Number.isFinite(ms)) return null;
  // Discard Unix-epoch noise and clearly invalid historical values.
  if (ms < Date.UTC(2000, 0, 1)) return null;
  return ms;
}

function formatTimelineGroupLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PortalProjectTimelineView({ tasks }: { tasks: PortalProjectTask[] }) {
  const { dated, undated } = useMemo(() => {
    const withDue: Array<PortalProjectTask & { dueMs: number }> = [];
    const withoutDue: PortalProjectTask[] = [];

    for (const task of tasks) {
      const dueMs = parsePortalDueMs(task.dueDate);
      if (dueMs == null) {
        withoutDue.push(task);
      } else {
        withDue.push({ ...task, dueMs });
      }
    }

    withDue.sort((a, b) => a.dueMs - b.dueMs || a.title.localeCompare(b.title));
    withoutDue.sort((a, b) => a.title.localeCompare(b.title));

    return { dated: withDue, undated: withoutDue };
  }, [tasks]);

  const groups = useMemo(() => {
    const map = new Map<string, Array<PortalProjectTask & { dueMs: number }>>();
    for (const task of dated) {
      const key = new Date(task.dueMs).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return [...map.entries()].map(([ymd, items]) => ({
      ymd,
      dueMs: items[0]!.dueMs,
      items,
    }));
  }, [dated]);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.ymd}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
            >
              <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-2.5">
                <p className="text-sm font-medium text-[var(--ozer-text-on-light)]">
                  {formatTimelineGroupLabel(group.dueMs)}
                </p>
                <p className="text-[11px] text-[var(--ozer-text-on-light-muted)]">
                  {group.items.length} task
                  {group.items.length === 1 ? '' : 's'} due
                </p>
              </div>
              <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                {group.items.map((task) => {
                  const status = normalizeStatus(task.status);
                  return (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                          {task.title}
                        </p>
                        {task.assigneeName ? (
                          <p className="truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                            {task.assigneeName}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                          STATUS_STYLES[status] ?? STATUS_STYLES.todo
                        }`}
                      >
                        {STATUS_LABELS[status] ?? status.replace('_', ' ')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          No tasks with a due date yet.
        </p>
      )}

      {undated.length > 0 ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-2.5">
            <p className="text-sm font-medium text-[var(--ozer-text-on-light)]">
              No due date
            </p>
            <p className="text-[11px] text-[var(--ozer-text-on-light-muted)]">
              {undated.length} task{undated.length === 1 ? '' : 's'} — still on
              the board, just without a date
            </p>
          </div>
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {undated.map((task) => {
              const status = normalizeStatus(task.status);
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {task.title}
                    </p>
                    {task.assigneeName ? (
                      <p className="truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                        {task.assigneeName}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.todo
                    }`}
                  >
                    {STATUS_LABELS[status] ?? status.replace('_', ' ')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PortalProjectPhaseKanbanView({
  phases,
  tasks,
  commentsByTask,
  drafts,
  setDrafts,
  pending,
  onSubmit,
  expandedTaskId,
  setExpandedTaskId,
}: {
  phases: PortalProjectPhase[];
  tasks: PortalProjectTask[];
  commentsByTask: Map<string, PortalTaskComment[]>;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
}) {
  const columns = useMemo(() => {
    const phaseCols = [...phases]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((phase) => ({
        key: phase.id,
        label: phase.name,
      }));
    return [...phaseCols, { key: '__unassigned__', label: 'Unassigned' }];
  }, [phases]);

  const byPhase = useMemo(() => {
    const map = new Map<string, PortalProjectTask[]>();
    for (const col of columns) map.set(col.key, []);
    for (const task of tasks) {
      const key =
        task.phaseId && map.has(task.phaseId) ? task.phaseId : '__unassigned__';
      map.get(key)?.push(task);
    }
    return map;
  }, [columns, tasks]);

  if (phases.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No phases yet. Switch to Progress to browse tasks by status.
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col, index) => {
        const columnTasks = byPhase.get(col.key) ?? [];
        if (col.key === '__unassigned__' && columnTasks.length === 0) {
          return null;
        }
        const colour =
          PHASE_COLUMN_COLOURS[index % PHASE_COLUMN_COLOURS.length] ??
          '#64748B';
        return (
          <div
            key={col.key}
            className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80"
            style={{ borderTopWidth: 3, borderTopColor: colour }}
          >
            <div className="border-b border-[color:var(--workspace-shell-border)]/80 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
                  {col.label}
                </h3>
                <span className="rounded-full bg-[var(--workspace-shell-panel-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--ozer-text-on-light-muted)]">
                  {columnTasks.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {columnTasks.map((task) => {
                const open = expandedTaskId === task.id;
                const priorityKey = task.priority || 'none';
                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)] p-3 shadow-sm"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedTaskId(open ? null : task.id)}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priorityKey] ?? PRIORITY_DOT.none}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug font-medium text-[var(--ozer-text-on-light)]">
                            {task.title}
                          </p>
                          <TaskCardMeta task={task} />
                        </div>
                      </div>
                    </button>
                    {open ? (
                      <TaskComments
                        className="mt-3"
                        taskId={task.id}
                        comments={commentsByTask.get(task.id) ?? []}
                        drafts={drafts}
                        setDrafts={setDrafts}
                        pending={pending}
                        onSubmit={onSubmit}
                      />
                    ) : (
                      <p className="mt-2 pl-4 text-[11px] text-[var(--ozer-text-on-light-muted)]">
                        {(commentsByTask.get(task.id) ?? []).length} comment
                        {(commentsByTask.get(task.id) ?? []).length === 1
                          ? ''
                          : 's'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PortalProjectBoard({
  clientOrgId,
  projectId,
  initialTasks,
  initialPhases,
  initialComments,
  isPhased = false,
}: {
  clientOrgId: string;
  projectId: string;
  initialTasks: PortalProjectTask[];
  initialPhases: PortalProjectPhase[];
  initialComments: PortalTaskComment[];
  isPhased?: boolean;
}) {
  const [view, setView] = useState<ViewMode>('board');
  const [boardMode, setBoardMode] = useState<BoardMode>(
    isPhased ? 'phase' : 'progress',
  );

  useEffect(() => {
    if (!isPhased) setBoardMode('progress');
  }, [isPhased]);
  const [comments, setComments] =
    useState<PortalTaskComment[]>(initialComments);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const commentsByTask = useMemo(() => {
    const map = new Map<string, PortalTaskComment[]>();
    for (const comment of comments) {
      const list = map.get(comment.taskId) ?? [];
      list.push(comment);
      map.set(comment.taskId, list);
    }
    return map;
  }, [comments]);

  function submitComment(taskId: string) {
    const body = (drafts[taskId] ?? '').trim();
    if (!body) return;

    startTransition(async () => {
      try {
        const comment = await addPortalTaskComment({
          clientOrgId,
          taskId,
          projectId,
          body,
        });
        setComments((prev) => [...prev, comment]);
        setDrafts((prev) => ({ ...prev, [taskId]: '' }));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not add comment',
        );
      }
    });
  }

  const viewButtons: {
    key: ViewMode;
    label: string;
    icon: typeof Columns3;
  }[] = [
    { key: 'board', label: 'Board', icon: Columns3 },
    { key: 'timeline', label: 'Timeline', icon: GanttChart },
    { key: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3">
        <div className="flex items-center gap-1">
          {viewButtons.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === key
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--ozer-text-on-light-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--ozer-text-on-light)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {view === 'board' && isPhased ? (
          <div className="flex items-center gap-0.5 rounded-md border border-[color:var(--workspace-shell-border)] p-0.5">
            {(
              [
                { key: 'phase', label: 'Phase' },
                { key: 'progress', label: 'Progress' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setBoardMode(key)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  boardMode === key
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                    : 'text-[var(--ozer-text-on-light-muted)] hover:text-[var(--ozer-text-on-light)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {view === 'list' ? (
        <PortalProjectListView
          tasks={initialTasks}
          commentsByTask={commentsByTask}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          onSubmit={submitComment}
          expandedTaskId={expandedTaskId}
          setExpandedTaskId={setExpandedTaskId}
        />
      ) : null}

      {view === 'board' && boardMode === 'progress' ? (
        <PortalProjectKanbanView
          tasks={initialTasks}
          commentsByTask={commentsByTask}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          onSubmit={submitComment}
          expandedTaskId={expandedTaskId}
          setExpandedTaskId={setExpandedTaskId}
        />
      ) : null}

      {view === 'board' && isPhased && boardMode === 'phase' ? (
        <PortalProjectPhaseKanbanView
          phases={initialPhases}
          tasks={initialTasks}
          commentsByTask={commentsByTask}
          drafts={drafts}
          setDrafts={setDrafts}
          pending={pending}
          onSubmit={submitComment}
          expandedTaskId={expandedTaskId}
          setExpandedTaskId={setExpandedTaskId}
        />
      ) : null}

      {view === 'timeline' ? (
        <PortalProjectTimelineView tasks={initialTasks} />
      ) : null}
    </div>
  );
}
