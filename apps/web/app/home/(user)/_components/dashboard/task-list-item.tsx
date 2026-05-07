'use client';

import { useState } from 'react';

import { Circle, CheckCircle2, AlertTriangle, Clock, Pencil } from 'lucide-react';

import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { EditTaskDialog } from '../../tasks/_components/edit-task-dialog';

export type TaskListItemProps = {
  title: string;
  project?: string;
  area?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  accentColor?: string;
  /** When set, shows Edit (same popup as /home/tasks) including delete. */
  editTask?: TasksPageTask | null;
};

const priorityConfig = {
  low: { label: 'Low', className: 'text-zinc-400' },
  medium: { label: 'Med', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
} as const;

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
} as const;

export function TaskListItem({
  title,
  project,
  area,
  dueDate,
  priority,
  status,
  accentColor,
  editTask,
}: TaskListItemProps) {
  const [editOpen, setEditOpen] = useState(false);
  const StatusIcon = statusIcons[status];
  const priorityCfg = priorityConfig[priority];

  return (
    <>
    <div className="group flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-white/10">
      <span className="mt-0.5 shrink-0">
        {status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <StatusIcon className="h-4 w-4 text-zinc-500" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium leading-snug ${
            status === 'completed'
              ? 'text-zinc-500 line-through'
              : 'text-white'
          }`}
        >
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          {editTask?.workspaceName && (
            <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 font-medium text-violet-200">
              {editTask.workspaceName}
            </span>
          )}
          {(project || area) && (
            <span className="flex items-center gap-1.5">
              {accentColor && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              {project ?? area}
            </span>
          )}
          {dueDate && <span>{dueDate}</span>}
          {priority !== 'low' && (
            <span className={`font-medium ${priorityCfg.className}`}>
              {priority === 'urgent' && (
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
              )}
              {priorityCfg.label}
            </span>
          )}
        </div>
      </div>
      {editTask ? (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-white/16 hover:text-white"
          aria-label="Edit task"
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      ) : null}
    </div>
    {editTask ? (
      <EditTaskDialog
        task={editTask}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    ) : null}
    </>
  );
}
