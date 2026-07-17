'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  createTask,
  getTasksForClient,
} from '~/home/(user)/_lib/actions/task-actions';
import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';
import { EditTaskDialog } from '~/home/(user)/tasks/_components/edit-task-dialog';

const priorityConfig: Record<string, string> = {
  low: 'text-[var(--workspace-shell-text-muted)]',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  urgent: 'text-rose-400',
};

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

export function ClientTasksBlock({
  clientId,
  clientName,
  canEditClients,
  tasksHref,
  workspaceAccountId,
}: {
  clientId: string;
  clientName: string;
  canEditClients: boolean;
  /** Link to full tasks page (e.g. /home/tasks) */
  tasksHref: string;
  /** Team account id — scopes Edit Task assignment to this workspace. */
  workspaceAccountId?: string;
}) {
  const [tasks, setTasks] = useState<TasksPageTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<TasksPageTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasksForClient(clientId);
      setTasks(data ?? []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Tasks
        </h3>
        {canEditClients && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ozer-accent-muted)] hover:bg-[var(--ozer-accent-subtle)] hover:text-[var(--ozer-accent-muted)]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add task
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No tasks linked to this client yet.
          {canEditClients && ' Use "Add task" to create one.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            return (
              <li key={task.id}>
                <div className="flex items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm transition hover:border-[color:var(--workspace-shell-border)]">
                  <StatusIcon
                    className={`h-4 w-4 shrink-0 ${
                      task.status === 'completed'
                        ? 'text-[var(--ozer-accent-muted)]'
                        : 'text-[var(--workspace-shell-text-muted)]'
                    }`}
                  />
                  <Link
                    href={tasksHref}
                    className={`min-w-0 flex-1 truncate hover:underline ${task.status === 'completed' ? 'text-[var(--workspace-shell-text-muted)] line-through' : 'text-[var(--workspace-shell-text)]'}`}
                  >
                    {task.title}
                  </Link>
                  <span
                    className={`hidden shrink-0 text-xs sm:inline ${priorityConfig[task.priority] ?? 'text-[var(--workspace-shell-text-muted)]'}`}
                  >
                    {task.priority}
                  </span>
                  {task.dueDateLabel && (
                    <span className="hidden shrink-0 text-xs text-[var(--workspace-shell-text-muted)] sm:inline">
                      {task.dueDateLabel}
                    </span>
                  )}
                  {canEditClients && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditTask(task);
                        setEditOpen(true);
                      }}
                      className="shrink-0 rounded p-1 text-[var(--workspace-shell-text-muted)] transition hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                      aria-label="Edit task"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > 0 && (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          <Link
            href={tasksHref}
            className="underline hover:text-[var(--workspace-shell-text-muted)]"
          >
            View all tasks →
          </Link>
        </p>
      )}

      {canEditClients && editTask && (
        <EditTaskDialog
          task={editTask}
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (!next) {
              setEditTask(null);
            }
          }}
          workspaceAccountId={workspaceAccountId}
          onSaved={fetchTasks}
          onDeleted={fetchTasks}
        />
      )}

      {canEditClients && (
        <AddTaskForClientDialog
          clientId={clientId}
          clientName={clientName}
          open={addOpen}
          onOpenChange={setAddOpen}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            fetchTasks();
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddTaskForClientDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
  isPending,
  startTransition,
  onSuccess,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    startTransition(async () => {
      const result = await createTask({
        title: trimmed,
        priority,
        dueDate: dueDate || undefined,
        clientId,
        accountId: workspaceAccountId,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to create task');
        return;
      }
      toast.success('Task added');
      setTitle('');
      setPriority('medium');
      setDueDate('');
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add task for {clientName || 'client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="task-title"
              className="text-[var(--workspace-shell-text-muted)]"
            >
              Title *
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="task-due"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Due date
              </Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
