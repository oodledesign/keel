'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { cn } from '@kit/ui/utils';
import { toast } from '@kit/ui/sonner';

import { EditTaskDialog } from '~/home/(user)/tasks/_components/edit-task-dialog';
import { loadTaskForEdit } from '~/home/(user)/_lib/actions/task-actions';
import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

type DashboardTaskDetailTriggerProps = {
  taskId: string;
  /** Team workspace dashboard — scopes assignment options to this account. */
  workspaceAccountId?: string;
  className?: string;
  children: React.ReactNode;
};

export function DashboardTaskDetailTrigger({
  taskId,
  workspaceAccountId,
  className,
  children,
}: DashboardTaskDetailTriggerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TasksPageTask | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const openTask = useCallback(() => {
    startTransition(async () => {
      try {
        const loaded = await loadTaskForEdit(taskId, workspaceAccountId);

        if (!loaded) {
          toast.error('Could not open this task');
          return;
        }

        setTask(loaded);
        setOpen(true);
      } catch {
        toast.error('Could not open this task');
      }
    });
  }, [taskId, workspaceAccountId]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openTask}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openTask();
          }
        }}
        aria-disabled={isPending}
        className={cn(
          'w-full text-left transition-colors',
          'hover:border-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A9D8F]/50',
          isPending && 'pointer-events-none opacity-60',
          className,
        )}
        aria-label="Open task details"
      >
        {children}
      </div>

      {task ? (
        <EditTaskDialog
          task={task}
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
