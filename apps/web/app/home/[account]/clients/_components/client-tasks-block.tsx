'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { CheckCircle2, Circle, Clock, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

const priorityConfig: Record<string, string> = {
  low: 'text-zinc-400',
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
}: {
  clientId: string;
  clientName: string;
  canEditClients: boolean;
  /** Link to full tasks page (e.g. /home/tasks) */
  tasksHref: string;
}) {
  const [tasks, setTasks] = useState<TasksPageTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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
    <div className="space-y-3 border-t border-zinc-700 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Tasks</h3>
        {canEditClients && (
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add task
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tasks linked to this client yet.
          {canEditClients && ' Use "Add task" to create one.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            return (
              <li key={task.id}>
                <Link
                  href={tasksHref}
                  className="flex items-center gap-2 rounded-md border border-zinc-700 bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm transition hover:border-zinc-600 hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <StatusIcon
                    className={`h-4 w-4 shrink-0 ${
                      task.status === 'completed'
                        ? 'text-emerald-400'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span
                    className={`min-w-0 flex-1 ${task.status === 'completed' ? 'text-zinc-400 line-through' : 'text-white'}`}
                  >
                    {task.title}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${priorityConfig[task.priority] ?? 'text-zinc-400'}`}
                  >
                    {task.priority}
                  </span>
                  {task.dueDateLabel && (
                    <span className="shrink-0 text-xs text-zinc-500">
                      {task.dueDateLabel}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > 0 && (
        <p className="text-xs text-zinc-500">
          <Link href={tasksHref} className="underline hover:text-zinc-400">
            View all tasks →
          </Link>
        </p>
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
      <DialogContent className="border-zinc-700 bg-[var(--workspace-shell-panel)] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add task for {clientName || 'client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-zinc-300">
              Title *
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="border-zinc-600 bg-white/5 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-zinc-600 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-600 bg-[#1A2535] text-white">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due" className="text-zinc-300">
                Due date
              </Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-zinc-600 bg-white/5 text-white"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-600 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-500"
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
