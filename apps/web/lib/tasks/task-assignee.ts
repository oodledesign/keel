import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

/** True when a contact or another team member owns the task. */
export function isAssignedToSomeoneElse(
  task: Pick<
    TasksPageTask,
    'assigneeUserId' | 'assigneeContactId' | 'assigneeName'
  >,
  currentUserId: string | null | undefined,
): boolean {
  if (task.assigneeContactId) return true;
  if (!task.assigneeUserId || !currentUserId) return false;
  return task.assigneeUserId !== currentUserId;
}

export function taskAssigneeDisplayName(
  task: Pick<TasksPageTask, 'assigneeName'>,
): string {
  return task.assigneeName?.trim() || 'Assigned';
}
