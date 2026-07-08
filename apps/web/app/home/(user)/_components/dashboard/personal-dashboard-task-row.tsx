'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { DashboardTaskDetailTrigger } from '~/components/dashboard/dashboard-task-detail-trigger';
import pathsConfig from '~/config/paths.config';

import type { PersonalDashboardTask } from '../../_lib/server/ozer-dashboard.loader';

const priorityStyles = {
  low: 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
  medium: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  high: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  urgent: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
} as const;

const priorityLabels = {
  low: 'Low',
  medium: 'Normal',
  high: 'High',
  urgent: 'Urgent',
} as const;

export function PersonalDashboardTaskRow(props: {
  task: PersonalDashboardTask;
}) {
  const { task } = props;

  return (
    <DashboardTaskDetailTrigger
      taskId={task.id}
      className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            task.isOverdue ? 'text-rose-200' : 'text-[var(--workspace-shell-text)]',
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <WorkspaceChip
            name={task.workspaceName}
            color={task.workspaceColor}
            slug={task.workspaceSlug}
          />
          {task.dueLabel ? (
            <span
              className={cn(
                'text-xs',
                task.isOverdue ? 'text-rose-300/90' : 'text-[var(--workspace-shell-text)]/50',
              )}
            >
              {task.isOverdue ? `Overdue · ${task.dueLabel}` : task.dueLabel}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          priorityStyles[task.priority],
        )}
      >
        {priorityLabels[task.priority]}
      </span>
    </DashboardTaskDetailTrigger>
  );
}

function WorkspaceChip(props: { name: string; color: string; slug: string | null }) {
  const inner = (
    <>
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: props.color }}
      />
      <span className="truncate">{props.name}</span>
    </>
  );

  const className =
    'inline-flex max-w-[140px] items-center gap-1.5 rounded-md border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/90';

  if (props.slug) {
    const href = pathsConfig.app.accountHome.replace('[account]', props.slug);
    return (
      <Link
        href={href}
        onClick={(event) => event.stopPropagation()}
        className={cn(className, 'transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]')}
      >
        {inner}
      </Link>
    );
  }

  return <span className={className}>{inner}</span>;
}
