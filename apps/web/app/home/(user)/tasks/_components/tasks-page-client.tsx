'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, Pencil, Search } from 'lucide-react';

import { Checkbox } from '@kit/ui/checkbox';

import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { updateTask } from '../../_lib/actions/task-actions';
import { AddTaskDialog } from '../../_components/dashboard/add-task-dialog';
import { EditTaskDialog } from './edit-task-dialog';

const priorityConfig = {
  low: { label: 'Low', className: 'text-zinc-400' },
  medium: { label: 'Medium', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
} as const;

type Props = {
  initialTasks: TasksPageTask[];
  /** Team workspace: only tasks linked to this account’s projects/clients; hides life/work scope toggle. */
  variant?: 'personal' | 'workspace';
  /** Required when `variant="workspace"` — enables Add Task for this team account. */
  workspaceAccountId?: string;
};

export function TasksPageClient({
  initialTasks,
  variant = 'personal',
  workspaceAccountId,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>(
    variant === 'workspace' ? 'work' : 'all',
  );
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed'>(
    'active',
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return initialTasks.filter((t) => {
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (
        variant !== 'workspace' &&
        filter !== 'all' &&
        t.context !== filter
      ) {
        return false;
      }
      if (search) {
        const q = search.trim().toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inWorkspace = (t.workspaceName ?? '').toLowerCase().includes(q);
        if (!inTitle && !inWorkspace) {
          return false;
        }
      }
      return true;
    });
  }, [initialTasks, filter, statusFilter, search, variant]);

  const urgent = filtered.filter(
    (t) => t.priority === 'urgent' || t.priority === 'high',
  );
  const rest = filtered.filter(
    (t) => t.priority !== 'urgent' && t.priority !== 'high',
  );

  const activeCount = useMemo(
    () => initialTasks.filter((t) => t.status !== 'completed').length,
    [initialTasks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {variant === 'workspace'
              ? `${activeCount} active tasks linked to this workspace`
              : `${activeCount} active tasks across work and life`}
          </p>
        </div>
        {variant === 'personal' ? (
          <AddTaskDialog />
        ) : workspaceAccountId ? (
          <AddTaskDialog workspaceAccountId={workspaceAccountId} />
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="h-10 w-full rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-white/16 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {variant === 'personal' ? (
            <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
              {(['all', 'work', 'life'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 font-medium capitalize transition-colors ${
                    filter === f
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
            {(['active', 'completed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Urgent/High priority */}
      {urgent.length > 0 && statusFilter === 'active' && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Priority
          </h2>
          <div className="space-y-2">
            {urgent.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showWorkspaceTag={variant === 'personal'}
                workspaceAccountId={workspaceAccountId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Rest */}
      <section>
        {statusFilter === 'active' && urgent.length > 0 && (
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Everything else
          </h2>
        )}
        <div className="space-y-2">
          {rest.length === 0 && urgent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-6 py-12 text-center text-sm text-zinc-500">
              {statusFilter === 'completed'
                ? 'No completed tasks yet'
                : variant === 'workspace' && initialTasks.length === 0
                  ? 'No tasks linked to this workspace yet. Use Add Task and choose a project or client, or open a client record.'
                  : 'No tasks match your filters'}
            </div>
          ) : (
            rest.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showWorkspaceTag={variant === 'personal'}
                workspaceAccountId={workspaceAccountId}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TaskRow({
  task,
  showWorkspaceTag,
  workspaceAccountId,
}: {
  task: TasksPageTask;
  showWorkspaceTag?: boolean;
  workspaceAccountId?: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const priorityCfg = priorityConfig[task.priority];
  const isDone = task.status === 'completed';

  const handleCheckedChange = (checked: boolean) => {
    startTransition(async () => {
      const result = await updateTask(task.id, {
        status: checked ? 'completed' : 'pending',
      });
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="group flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-white/10">
        <Checkbox
          checked={isDone}
          disabled={isPending}
          onCheckedChange={(value) => {
            if (value === 'indeterminate') return;
            handleCheckedChange(Boolean(value));
          }}
          aria-label={
            isDone ? 'Mark task as not done' : 'Mark task as done'
          }
          className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-white/25 shadow-none data-[state=checked]:border-[#57C87F] data-[state=checked]:bg-[#57C87F]/20 data-[state=checked]:text-[#57C87F]"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium leading-snug ${
              task.status === 'completed'
                ? 'text-zinc-500 line-through'
                : 'text-white'
            }`}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {showWorkspaceTag && task.workspaceName && (
              <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 font-medium text-violet-200">
                {task.workspaceName}
              </span>
            )}
            {task.clientName && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-zinc-300">
                {task.clientName}
              </span>
            )}
            {(task.projectName || task.areaLabel) && (
              <span className="flex items-center gap-1.5">
                {task.accentColor && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: task.accentColor }}
                  />
                )}
                {task.projectName ?? task.areaLabel}
              </span>
            )}
            {task.dueDateLabel && <span>{task.dueDateLabel}</span>}
            {task.priority !== 'low' && (
              <span className={`font-medium ${priorityCfg.className}`}>
                {task.priority === 'urgent' && (
                  <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                )}
                {priorityCfg.label}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ml-2 hidden items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-white sm:inline-flex"
          aria-label="Edit task"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      <EditTaskDialog
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceAccountId={workspaceAccountId}
      />
    </>
  );
}

