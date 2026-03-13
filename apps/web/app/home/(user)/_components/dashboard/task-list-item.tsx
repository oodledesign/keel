'use client';

import { Circle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export type TaskListItemProps = {
  title: string;
  project?: string;
  area?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  accentColor?: string;
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
}: TaskListItemProps) {
  const StatusIcon = statusIcons[status];
  const priorityCfg = priorityConfig[priority];

  return (
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
    </div>
  );
}
