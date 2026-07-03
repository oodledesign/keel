import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

import type { PlannerTask } from './types';

export function plannerTaskToPageTask(task: PlannerTask): TasksPageTask {
  return {
    id: task.id,
    title: task.title,
    projectName:
      task.project === 'No project' || task.project.toLowerCase() === 'general'
        ? null
        : task.project,
    areaLabel: null,
    context: task.context,
    status: task.status,
    priority: task.priority,
    dueDateLabel: task.dueDateLabel,
    dueDate: task.due_date,
    accentColor: task.accentColor,
    clientId: task.clientId,
    projectId: task.projectId,
    areaId: task.areaId,
    clientName: task.clientName,
    workspaceName: task.workspace,
    workspaceSlug: task.workspaceSlug,
    workspaceColor: task.workspaceColor,
    parentTaskId: task.parentTaskId,
    notes: task.notes,
    calendarScheduleStatus: task.calendarScheduleStatus,
  };
}
