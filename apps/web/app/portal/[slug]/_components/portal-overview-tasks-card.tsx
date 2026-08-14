'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { CheckSquare } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import type { PortalOverviewTask } from '../_lib/server/client-portal.service';
import { formatPortalDate } from './portal-badges';

type TaskScope = 'all' | 'mine';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  pending: 'To do',
  in_progress: 'In progress',
  client_review: 'Review',
  done: 'Done',
  completed: 'Done',
};

export function PortalOverviewTasksCard({
  allTasks,
  myTasks,
  myTasksHref,
  projectsHref,
}: {
  allTasks: PortalOverviewTask[];
  myTasks: PortalOverviewTask[];
  myTasksHref: string;
  projectsHref: string;
}) {
  const [scope, setScope] = useState<TaskScope>('mine');

  const tasks = useMemo(
    () => (scope === 'mine' ? myTasks : allTasks),
    [allTasks, myTasks, scope],
  );

  const openTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const status = (task.status ?? '').toLowerCase();
        return (
          status !== 'done' &&
          status !== 'completed' &&
          status !== 'cancelled'
        );
      }),
    [tasks],
  );

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Tasks</CardTitle>
          <CheckSquare className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-[color:var(--workspace-shell-border)] p-0.5">
          {(
            [
              { key: 'mine', label: 'My tasks' },
              { key: 'all', label: 'All tasks' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                scope === key
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--ozer-text-on-light-muted)] hover:text-[var(--ozer-text-on-light)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {openTasks.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            {scope === 'mine'
              ? 'No tasks assigned to you right now.'
              : 'No open project tasks right now.'}
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
            {openTasks.slice(0, 6).map((task) => (
              <li key={task.id} className="px-3 py-2.5">
                <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                  {task.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                  {[
                    STATUS_LABELS[task.status] ?? task.status,
                    task.projectName,
                    task.assigneeName,
                    task.dueDate
                      ? `Due ${formatPortalDate(task.dueDate)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={scope === 'mine' ? myTasksHref : projectsHref}>
            {scope === 'mine' ? 'View my tasks' : 'View projects'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
