'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  deleteTask,
  loadTaskForEdit,
  updateTask,
} from '~/home/(user)/_lib/actions/task-actions';
import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';
import { EditTaskDialog } from '~/home/(user)/tasks/_components/edit-task-dialog';
import { useOptimisticDone } from '~/lib/tasks/use-optimistic-done';

import type { DashboardTaskSummary } from '../_lib/server/dashboard-page.loader';

type Props = {
  task: DashboardTaskSummary;
  workspaceAccountId: string;
};

export function DashboardUpcomingTaskItem({ task, workspaceAccountId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editTask, setEditTask] = useState<TasksPageTask | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isDone, setOptimisticDone } = useOptimisticDone(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const openTask = useCallback(() => {
    startTransition(async () => {
      try {
        const loaded = await loadTaskForEdit(task.id, workspaceAccountId);

        if (!loaded) {
          toast.error('Could not open this task');
          return;
        }

        setEditTask(loaded);
        setOpen(true);
      } catch {
        toast.error('Could not open this task');
      }
    });
  }, [task.id, workspaceAccountId]);

  function markComplete() {
    if (isDone) return;
    setOptimisticDone(true);
    void (async () => {
      const result = await updateTask(task.id, { status: 'completed' });

      if (!result.success) {
        setOptimisticDone(false);
        toast.error(result.error ?? 'Could not complete task');
        return;
      }

      toast.success('Task completed');
      refresh();
    })();
  }

  function removeTask() {
    startTransition(async () => {
      const result = await deleteTask(task.id);

      if (!result.success) {
        toast.error(result.error ?? 'Could not delete task');
        return;
      }

      toast.success('Task deleted');
      refresh();
    });
  }

  return (
    <>
      <li
        className={cn(
          'flex items-stretch gap-1 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
          isDone && 'opacity-50',
          isPending && !isDone && 'pointer-events-none opacity-60',
        )}
      >
        <div className="flex items-start pt-3 pl-3">
          <Checkbox
            checked={isDone}
            onCheckedChange={(value) => {
              if (value === 'indeterminate' || isDone) return;
              markComplete();
            }}
            aria-label={isDone ? 'Task completed' : 'Mark task as done'}
            className="h-5 w-5 shrink-0 rounded-full border-[color:var(--workspace-shell-border)] shadow-none data-[state=checked]:border-[var(--ozer-accent)] data-[state=checked]:bg-[var(--ozer-accent-subtle)] data-[state=checked]:text-[var(--ozer-accent)]"
          />
        </div>
        <button
          type="button"
          onClick={openTask}
          className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/50 focus-visible:outline-none"
        >
          <span
            className={cn(
              'block text-sm font-medium text-[var(--workspace-shell-text)]',
              isDone && 'text-[var(--workspace-shell-text-muted)] line-through',
            )}
          >
            {task.title}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
            {[task.projectName, formatTaskDue(task.dueDate)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 mr-1 h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
              aria-label="Task actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={openTask}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDone} onSelect={markComplete}>
              <Check className="mr-2 h-3.5 w-3.5" />
              Mark complete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={removeTask}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>

      {editTask ? (
        <EditTaskDialog
          task={editTask}
          open={open}
          onOpenChange={setOpen}
          workspaceAccountId={workspaceAccountId}
          onSaved={refresh}
          onDeleted={refresh}
        />
      ) : null}
    </>
  );
}

function formatTaskDue(iso: string | null): string | null {
  if (!iso) return 'No due date';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return null;
  }
}
