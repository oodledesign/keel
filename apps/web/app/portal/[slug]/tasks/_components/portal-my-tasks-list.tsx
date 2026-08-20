'use client';

import { useState, useTransition } from 'react';

import { Check } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import { formatPortalDate } from '../../_components/portal-badges';
import type { PortalMyTask } from '../../_lib/server/client-portal.service';
import { completePortalMyTask } from '../../_lib/server/server-actions';

export function PortalMyTasksList({
  clientOrgId,
  initialTasks,
}: {
  clientOrgId: string;
  initialTasks: PortalMyTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const markDone = (taskId: string) => {
    const previous = tasks.find((t) => t.id === taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'done' } : t)),
    );
    setPendingId(taskId);
    startTransition(async () => {
      try {
        const updated = await completePortalMyTask({ clientOrgId, taskId });
        if (updated) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
          toast.success('Marked complete');
        } else if (previous) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)));
          toast.error('Could not update task');
        }
      } catch (e) {
        if (previous) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)));
        }
        toast.error(e instanceof Error ? e.message : 'Could not update task');
      } finally {
        setPendingId(null);
      }
    });
  };

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks have been assigned to you yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
          Open
        </h3>
        {openTasks.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            You’re all caught up.
          </p>
        ) : (
          openTasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-base text-[var(--ozer-text-on-light)]">
                    {task.title}
                  </CardTitle>
                  <p className="mt-1 text-xs text-[var(--ozer-text-on-light-muted)]">
                    {[
                      task.projectName,
                      task.dueDate
                        ? `Due ${formatPortalDate(task.dueDate)}`
                        : null,
                      task.priority ? task.priority : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending && pendingId === task.id}
                  onClick={() => markDone(task.id)}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Done
                </Button>
              </CardHeader>
              {task.notes ? (
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap text-[var(--ozer-text-on-light-muted)]">
                    {task.notes}
                  </p>
                </CardContent>
              ) : null}
            </Card>
          ))
        )}
      </section>

      {doneTasks.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
            Done
          </h3>
          {doneTasks.map((task) => (
            <Card key={task.id} className="opacity-70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[var(--ozer-text-on-light)] line-through">
                  {task.title}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
