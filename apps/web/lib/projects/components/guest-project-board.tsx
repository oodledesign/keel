'use client';

import { useMemo, useState, useTransition } from 'react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import type { ProjectGuestPermissions } from '~/lib/projects/project-guests.types';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  user_id: string | null;
  notes: string | null;
};

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export function GuestProjectBoard(props: {
  projectId: string;
  accountId: string;
  permissions: ProjectGuestPermissions;
  initialTasks: Array<Record<string, unknown>>;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>(
    props.initialTasks.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      status: String(row.status ?? 'todo'),
      priority: (row.priority as string | null) ?? null,
      due_date: (row.due_date as string | null) ?? null,
      user_id: (row.user_id as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    })),
  );
  const [newTitle, setNewTitle] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [pending, startTransition] = useTransition();

  const byStatus = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const task of tasks) {
      const key = COLUMNS.some((c) => c.key === task.status)
        ? task.status
        : 'todo';
      map.get(key)?.push(task);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-4">
      {props.permissions.create_task ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = newTitle.trim();
            if (!title) return;
            startTransition(async () => {
              try {
                const client = getSupabaseBrowserClient();
                const {
                  data: { user },
                } = await client.auth.getUser();
                if (!user) throw new Error('Sign in required');

                const { data, error } = await client
                  .from('tasks')
                  .insert({
                    title,
                    project_id: props.projectId,
                    account_id: props.accountId,
                    user_id: user.id,
                    status: 'todo',
                    priority: 'medium',
                  })
                  .select(
                    'id, title, status, priority, due_date, user_id, notes',
                  )
                  .single();

                if (error) throw new Error(error.message);
                setTasks((prev) => [
                  ...prev,
                  {
                    id: String(data.id),
                    title: String(data.title),
                    status: String(data.status ?? 'todo'),
                    priority: (data.priority as string | null) ?? null,
                    due_date: (data.due_date as string | null) ?? null,
                    user_id: (data.user_id as string | null) ?? null,
                    notes: (data.notes as string | null) ?? null,
                  },
                ]);
                setNewTitle('');
                toast.success('Task created');
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : 'Could not create task',
                );
              }
            });
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            className="border-[color:var(--workspace-shell-border)]"
          />
          <Button type="submit" disabled={pending || !newTitle.trim()}>
            Add
          </Button>
        </form>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/50 p-3"
          >
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              {col.label}
            </h2>
            <div className="space-y-2">
              {(byStatus.get(col.key) ?? []).map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {task.title}
                  </p>
                  {props.permissions.edit_own_task ? (
                    <select
                      className="mt-2 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-1 text-xs text-[var(--workspace-shell-text)]"
                      value={
                        COLUMNS.some((c) => c.key === task.status)
                          ? task.status
                          : 'todo'
                      }
                      disabled={pending}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        startTransition(async () => {
                          try {
                            const client = getSupabaseBrowserClient();
                            const {
                              data: { user },
                            } = await client.auth.getUser();
                            if (!user) throw new Error('Sign in required');
                            if (task.user_id && task.user_id !== user.id) {
                              throw new Error(
                                'You can only edit your own tasks',
                              );
                            }

                            const { error } = await client
                              .from('tasks')
                              .update({ status: nextStatus })
                              .eq('id', task.id)
                              .eq('user_id', user.id);

                            if (error) throw new Error(error.message);
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id
                                  ? { ...t, status: nextStatus }
                                  : t,
                              ),
                            );
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : 'Could not update task',
                            );
                          }
                        });
                      }}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {props.permissions.comment ? (
                    <div className="mt-2 space-y-1">
                      <Input
                        value={commentDrafts[task.id] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        placeholder="Add a comment…"
                        className="h-8 border-[color:var(--workspace-shell-border)] text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={
                          pending || !(commentDrafts[task.id] ?? '').trim()
                        }
                        onClick={() => {
                          const body = (commentDrafts[task.id] ?? '').trim();
                          if (!body) return;
                          startTransition(async () => {
                            try {
                              const client = getSupabaseBrowserClient();
                              const {
                                data: { user },
                              } = await client.auth.getUser();
                              if (!user) throw new Error('Sign in required');

                              // task_comments may lag generated Database types
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const { error } = await (client as any)
                                .from('task_comments')
                                .insert({
                                  task_id: task.id,
                                  project_id: props.projectId,
                                  account_id: props.accountId,
                                  author_id: user.id,
                                  body,
                                });

                              if (error) throw new Error(error.message);
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [task.id]: '',
                              }));
                              toast.success('Comment added');
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not comment',
                              );
                            }
                          });
                        }}
                      >
                        Comment
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {(byStatus.get(col.key) ?? []).length === 0 ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  No tasks
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
