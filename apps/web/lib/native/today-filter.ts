import type { NativeWorkspace } from './workspace-shared';

export type NativeTodayTask = {
  id: string;
  account_id: string | null;
  workspace_slug: string | null;
};

export type NativeTodayFinance = {
  account_id: string;
};

export type NativeTodayPayload<T extends NativeTodayTask> = {
  tasks_due_today: T[];
  overdue_tasks: T[];
  all_open_tasks: T[];
  finance?: NativeTodayFinance | null;
};

export function taskInWorkspace(
  task: NativeTodayTask,
  workspace: NativeWorkspace,
) {
  if (task.account_id && task.account_id === workspace.id) {
    return true;
  }

  if (task.workspace_slug && task.workspace_slug === workspace.slug) {
    return true;
  }

  if (workspace.isPersonal) {
    return !task.account_id && !task.workspace_slug;
  }

  return false;
}

export function filterRecorderTodayByWorkspace<T extends NativeTodayTask>(
  payload: NativeTodayPayload<T>,
  workspace: NativeWorkspace,
): NativeTodayPayload<T> {
  const match = (task: T) => taskInWorkspace(task, workspace);

  return {
    ...payload,
    tasks_due_today: payload.tasks_due_today.filter(match),
    overdue_tasks: payload.overdue_tasks.filter(match),
    all_open_tasks: payload.all_open_tasks.filter(match),
    finance: financeForWorkspace(payload.finance, workspace),
  };
}

function financeForWorkspace(
  finance: NativeTodayFinance | null | undefined,
  workspace: NativeWorkspace,
): NativeTodayFinance | null | undefined {
  if (finance == null) {
    return finance;
  }

  if (finance.account_id === workspace.id) {
    return finance;
  }

  // Personal Mac Today still shows the user's business chart; other team
  // workspaces only keep finance that belongs to them.
  return workspace.isPersonal ? finance : null;
}
