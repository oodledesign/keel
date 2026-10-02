'use client';

import { useState, useTransition } from 'react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { TaskStatusBadge } from '~/components/projects/task-status-badge';
import type { JobBoardTask } from '~/home/[account]/projects/_lib/schema/project-phases.schema';
import { taskStatusSelectClass } from '~/lib/projects/task-status-badge';

const STATUSES = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
] as const;

const fieldClass =
  'w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-2 text-sm text-[var(--workspace-shell-text)]';

/**
 * A task opened from the guest canvas. Guests can change tasks they own when
 * their invite allows it; anything else is read only.
 */
export function GuestTaskSheet({
  task,
  assigneeName,
  canEdit,
  onClose,
  onSaved,
}: {
  task: JobBoardTask | null;
  assigneeName: string | null;
  /** The invite allows editing and the task belongs to this guest. */
  canEdit: boolean;
  onClose: () => void;
  onSaved: (task: JobBoardTask) => void;
}) {
  const [pending, startTransition] = useTransition();
  // The parent remounts this per task, so edits are never overwritten by a
  // background refresh of the board.
  const [title, setTitle] = useState(task?.title ?? '');
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [priority, setPriority] = useState(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');

  const save = () => {
    if (!task) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error('A task needs a title');
      return;
    }
    startTransition(async () => {
      try {
        const client = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error('Sign in required');

        const patch = {
          title: nextTitle,
          status,
          priority,
          due_date: dueDate || null,
          notes: notes.trim() || null,
        };
        const { data, error } = await client
          .from('tasks')
          .update(patch)
          .eq('id', task.id)
          .select('id');
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) {
          throw new Error('Permission denied to update this task');
        }
        onSaved({ ...task, ...patch });
        toast.success('Task saved');
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save the task',
        );
      }
    });
  };

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md"
      >
        {task ? (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle>{canEdit ? 'Edit task' : task.title}</SheetTitle>
              <SheetDescription>
                {assigneeName ? `Assigned to ${assigneeName}` : 'Unassigned'}
                {canEdit ? '' : ' · view only'}
              </SheetDescription>
            </SheetHeader>

            {canEdit ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guest-task-title">Title</Label>
                  <Input
                    id="guest-task-title"
                    value={title}
                    maxLength={300}
                    onChange={(event) => setTitle(event.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-task-status">Status</Label>
                    <select
                      id="guest-task-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      className={`${fieldClass} ${taskStatusSelectClass(status)}`}
                    >
                      {STATUSES.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-task-priority">Priority</Label>
                    <select
                      id="guest-task-priority"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className={fieldClass}
                    >
                      {PRIORITIES.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-task-due">Due date</Label>
                  <Input
                    id="guest-task-due"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-task-notes">Notes</Label>
                  <Textarea
                    id="guest-task-notes"
                    value={notes}
                    rows={6}
                    maxLength={5000}
                    onChange={(event) => setNotes(event.target.value)}
                    className="text-base"
                  />
                </div>
                <SheetFooter className="gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={save} disabled={pending}>
                    {pending ? 'Saving…' : 'Save'}
                  </Button>
                </SheetFooter>
              </div>
            ) : (
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  <span className="text-[var(--workspace-shell-text-muted)] capitalize">
                    {task.priority} priority
                  </span>
                </div>
                {task.due_date ? (
                  <div>
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Due
                    </dt>
                    <dd>{task.due_date.slice(0, 10)}</dd>
                  </div>
                ) : null}
                {task.notes?.trim() ? (
                  <div>
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Notes
                    </dt>
                    <dd className="whitespace-pre-wrap">{task.notes}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
