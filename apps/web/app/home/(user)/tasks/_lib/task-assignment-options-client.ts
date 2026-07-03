import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import type { TaskAssignmentOption } from '../../_lib/actions/task-actions';

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  options: TaskAssignmentOption[];
  fetchedAt: number;
};

const assignmentOptionsCache = new Map<string, CacheEntry>();

export function assignmentOptionsCacheKey(workspaceAccountId?: string) {
  return workspaceAccountId ?? '__personal__';
}

export function getCachedAssignmentOptions(
  key: string,
): TaskAssignmentOption[] | null {
  const entry = assignmentOptionsCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    assignmentOptionsCache.delete(key);
    return null;
  }

  return entry.options;
}

export function setCachedAssignmentOptions(
  key: string,
  options: TaskAssignmentOption[],
) {
  assignmentOptionsCache.set(key, {
    options,
    fetchedAt: Date.now(),
  });
}

/** Enough to label the combobox before the full option list loads. */
export function seedAssignmentOptionsFromTask(
  task: TasksPageTask,
): TaskAssignmentOption[] {
  if (task.projectId && task.projectName) {
    return [
      {
        id: task.projectId,
        name: task.projectName,
        type: 'project',
        color: task.accentColor,
        accountName: task.workspaceName,
      },
    ];
  }

  if (task.clientId && task.clientName) {
    return [
      {
        id: task.clientId,
        name: task.clientName,
        type: 'client',
        color: null,
        accountName: task.workspaceName,
      },
    ];
  }

  if (task.areaId && task.areaLabel) {
    return [
      {
        id: task.areaId,
        name: task.areaLabel,
        type: 'area',
        color: task.accentColor,
      },
    ];
  }

  return [];
}

export function mergeAssignmentOptions(
  seeded: TaskAssignmentOption[],
  loaded: TaskAssignmentOption[],
): TaskAssignmentOption[] {
  const byId = new Map(loaded.map((option) => [option.id, option]));

  for (const option of seeded) {
    if (!byId.has(option.id)) {
      byId.set(option.id, option);
    }
  }

  return [...byId.values()];
}
