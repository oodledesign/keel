'use client';

import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';

import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { AddTaskDialog } from '../../_components/dashboard/add-task-dialog';
import { EditTaskDialog } from './edit-task-dialog';

const priorityConfig = {
  low: { label: 'Low', className: 'text-zinc-400' },
  medium: { label: 'Medium', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
} as const;

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
} as const;

type Props = {
  initialTasks: TasksPageTask[];
};

export function TasksPageClient({ initialTasks }: Props) {
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed'>(
    'active',
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return initialTasks.filter((t) => {
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (filter !== 'all' && t.context !== filter) return false;
      if (
        search &&
        !t.title.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [initialTasks, filter, statusFilter, search]);

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
            {activeCount} active tasks across work and life
          </p>
        </div>
        <AddTaskDialog />
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
              <TaskRow key={task.id} task={task} />
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
                : 'No tasks match your filters'}
            </div>
          ) : (
            rest.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>
      </section>
    </div>
  );
}

function TaskRow({ task }: { task: TasksPageTask }) {
  const [editOpen, setEditOpen] = useState(false);
  const StatusIcon = statusIcons[task.status];
  const priorityCfg = priorityConfig[task.priority];

  return (
    <>
      <div className="group flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-white/10">
        <span className="mt-0.5 shrink-0">
          {task.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <StatusIcon className="h-4 w-4 text-zinc-500" />
          )}
        </span>
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
      />
    </>
  );
}

