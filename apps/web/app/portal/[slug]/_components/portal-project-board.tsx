'use client';

import { useMemo, useState, useTransition } from 'react';

import { Columns3, GanttChart, List } from 'lucide-react';

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
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Review',
  done: 'Done',
  completed: 'Done',
  cancelled: 'Cancelled',
};

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
}: {
  taskId: string;
  comments: PortalTaskComment[];
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-lg bg-[var(--workspace-shell-panel-hover)] px-3 py-2"
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
          className="h-8 border-[color:var(--workspace-shell-border)] text-sm"
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

function PortalProjectListView({
  tasks,
  commentsByTask,
  drafts,
  setDrafts,
  pending,
  onSubmit,
}: {
  tasks: PortalProjectTask[];
  commentsByTask: Map<string, PortalTaskComment[]>;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: boolean;
  onSubmit: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-[var(--ozer-text-on-light)]">
              {task.title}
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-nav-text)]">
                {STATUS_LABELS[task.status] ?? task.status}
              </span>
              {task.dueDate ? (
                <span className="text-xs text-[var(--ozer-text-on-light-muted)]">
                  Due {formatPortalDate(task.dueDate)}
                </span>
              ) : null}
            </div>
          </div>
          <TaskComments
            taskId={task.id}
            comments={commentsByTask.get(task.id) ?? []}
            drafts={drafts}
            setDrafts={setDrafts}
            pending={pending}
            onSubmit={onSubmit}
          />
        </div>
      ))}
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
            className="w-[280px] shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel-hover)]/40 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[var(--ozer-text-on-light)] uppercase">
                {col.label}
              </p>
              <span className="text-xs text-[var(--ozer-text-on-light-muted)]">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => {
                const open = expandedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedTaskId(open ? null : task.id)}
                    >
                      <p className="text-sm font-medium text-[var(--ozer-text-on-light)]">
                        {task.title}
                      </p>
                      {task.dueDate ? (
                        <p className="mt-1 text-xs text-[var(--ozer-text-on-light-muted)]">
                          Due {formatPortalDate(task.dueDate)}
                        </p>
                      ) : null}
                    </button>
                    {open ? (
                      <TaskComments
                        taskId={task.id}
                        comments={commentsByTask.get(task.id) ?? []}
                        drafts={drafts}
                        setDrafts={setDrafts}
                        pending={pending}
                        onSubmit={onSubmit}
                      />
                    ) : (
                      <p className="mt-2 text-[11px] text-[var(--ozer-text-on-light-muted)]">
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

function PortalProjectTimelineView({ tasks }: { tasks: PortalProjectTask[] }) {
  const dated = useMemo(() => {
    return [...tasks]
      .filter((task) => task.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  }, [tasks]);

  const undated = useMemo(() => tasks.filter((task) => !task.dueDate), [tasks]);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  if (dated.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No due dates yet — switch to Board or List to browse tasks.
      </p>
    );
  }

  const starts = dated.map((task) => new Date(String(task.dueDate)).getTime());
  const min = Math.min(...starts);
  const max = Math.max(...starts);
  const span = Math.max(max - min, 1000 * 60 * 60 * 24 * 7);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        {dated.map((task) => {
          const t = new Date(String(task.dueDate)).getTime();
          const left = ((t - min) / span) * 100;
          return (
            <div key={task.id} className="grid grid-cols-[140px_1fr] gap-3">
              <div>
                <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                  {task.title}
                </p>
                <p className="text-xs text-[var(--ozer-text-on-light-muted)]">
                  {formatPortalDate(task.dueDate)}
                </p>
              </div>
              <div className="relative h-8 rounded-md bg-[var(--workspace-shell-panel-hover)]">
                <div
                  className="absolute top-1.5 h-5 w-5 rounded-full bg-[var(--ozer-accent)]"
                  style={{
                    left: `max(0%, min(calc(${left}% - 10px), calc(100% - 20px)))`,
                  }}
                  title={task.title}
                />
              </div>
            </div>
          );
        })}
      </div>
      {undated.length > 0 ? (
        <p className="text-xs text-[var(--ozer-text-on-light-muted)]">
          {undated.length} task{undated.length === 1 ? '' : 's'} without a due
          date.
        </p>
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
      {columns.map((col) => {
        const columnTasks = byPhase.get(col.key) ?? [];
        if (col.key === '__unassigned__' && columnTasks.length === 0) {
          return null;
        }
        return (
          <div
            key={col.key}
            className="w-[280px] shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel-hover)]/40 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[var(--ozer-text-on-light)] uppercase">
                {col.label}
              </p>
              <span className="text-xs text-[var(--ozer-text-on-light-muted)]">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => {
                const open = expandedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedTaskId(open ? null : task.id)}
                    >
                      <p className="text-sm font-medium text-[var(--ozer-text-on-light)]">
                        {task.title}
                      </p>
                      {task.dueDate ? (
                        <p className="mt-1 text-xs text-[var(--ozer-text-on-light-muted)]">
                          Due {formatPortalDate(task.dueDate)}
                        </p>
                      ) : null}
                    </button>
                    {open ? (
                      <TaskComments
                        taskId={task.id}
                        comments={commentsByTask.get(task.id) ?? []}
                        drafts={drafts}
                        setDrafts={setDrafts}
                        pending={pending}
                        onSubmit={onSubmit}
                      />
                    ) : (
                      <p className="mt-2 text-[11px] text-[var(--ozer-text-on-light-muted)]">
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
}: {
  clientOrgId: string;
  projectId: string;
  initialTasks: PortalProjectTask[];
  initialPhases: PortalProjectPhase[];
  initialComments: PortalTaskComment[];
}) {
  const [view, setView] = useState<ViewMode>('board');
  const [boardMode, setBoardMode] = useState<BoardMode>('phase');
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
        {view === 'board' ? (
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

      {view === 'board' && boardMode === 'phase' ? (
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
