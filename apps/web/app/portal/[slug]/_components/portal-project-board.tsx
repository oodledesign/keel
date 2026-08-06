'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import type {
  PortalProjectTask,
  PortalTaskComment,
} from '../_lib/server/client-portal.service';
import { addPortalTaskComment } from '../_lib/server/server-actions';
import { formatPortalDate } from './portal-badges';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Review',
  done: 'Done',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function PortalProjectBoard({
  clientOrgId,
  projectId,
  initialTasks,
  initialComments,
}: {
  clientOrgId: string;
  projectId: string;
  initialTasks: PortalProjectTask[];
  initialComments: PortalTaskComment[];
}) {
  const [comments, setComments] =
    useState<PortalTaskComment[]>(initialComments);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
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

  if (initialTasks.length === 0) {
    return (
      <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {initialTasks.map((task) => (
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

          <div className="mt-3 space-y-2">
            {(commentsByTask.get(task.id) ?? []).map((comment) => (
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
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              value={drafts[task.id] ?? ''}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
              }
              placeholder="Add a comment…"
              className="h-8 border-[color:var(--workspace-shell-border)] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitComment(task.id);
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !(drafts[task.id] ?? '').trim()}
              onClick={() => submitComment(task.id)}
            >
              Comment
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
