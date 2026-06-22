import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

import type {
  PlannerProjectNode,
  PlannerTask,
  PlannerWorkspaceNode,
} from './types';

function isOpenTask(task: TasksPageTask) {
  return task.status !== 'completed';
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return due.getTime() < today.getTime();
}

function workspaceLabel(task: TasksPageTask) {
  return (
    task.workspaceName ??
    task.areaLabel ??
    (task.context === 'work' ? 'Work' : 'Personal')
  );
}

function projectLabel(task: TasksPageTask) {
  return task.projectName ?? task.clientName ?? 'No project';
}

export function toPlannerTask(task: TasksPageTask): PlannerTask {
  return {
    id: task.id,
    title: task.title,
    project: projectLabel(task),
    workspace: workspaceLabel(task),
    workspaceSlug: task.workspaceSlug,
    priority: task.priority,
    status: task.status,
    estimated_duration_minutes: null,
    due_date: task.dueDate,
    dueDateLabel: task.dueDateLabel,
    notes: task.notes,
    overdue: isOverdue(task.dueDate),
    context: task.context,
    clientId: task.clientId,
    projectId: task.projectId,
    areaId: task.areaId,
    parentTaskId: task.parentTaskId,
    calendarScheduleStatus: task.calendarScheduleStatus,
    clientName: task.clientName,
    accentColor: task.accentColor,
    workspaceColor: task.workspaceColor,
  };
}

function sortPlannerTasks(a: PlannerTask, b: PlannerTask) {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const aDue = a.due_date ?? '9999-12-31';
  const bDue = b.due_date ?? '9999-12-31';
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }
  return a.title.localeCompare(b.title);
}

export function buildTaskTree(tasks: TasksPageTask[]): PlannerWorkspaceNode[] {
  const workspaces = new Map<string, PlannerWorkspaceNode>();

  for (const task of tasks.filter(isOpenTask)) {
    const plannerTask = toPlannerTask(task);
    const workspaceKey = plannerTask.workspace;
    const projectKey = plannerTask.project;

    const workspace =
      workspaces.get(workspaceKey) ??
      ({
        id: workspaceKey,
        name: workspaceKey,
        taskCount: 0,
        projects: [],
      } satisfies PlannerWorkspaceNode);

    let project = workspace.projects.find((p) => p.id === projectKey);
    if (!project) {
      project = {
        id: projectKey,
        name: projectKey,
        taskCount: 0,
        tasks: [],
      };
      workspace.projects.push(project);
    }

    project.tasks.push(plannerTask);
    project.taskCount += 1;
    workspace.taskCount += 1;
    workspaces.set(workspaceKey, workspace);
  }

  return [...workspaces.values()]
    .map((workspace) => ({
      ...workspace,
      projects: workspace.projects
        .map((project) => ({
          ...project,
          tasks: project.tasks.sort(sortPlannerTasks),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function flattenPlannerTasks(
  tree: PlannerWorkspaceNode[],
): PlannerTask[] {
  return tree.flatMap((workspace) =>
    workspace.projects.flatMap((project) => project.tasks),
  );
}

export function filterTasksForIncludeWorkspacePref(
  tasks: TasksPageTask[],
  includeWorkspaceTasks: boolean,
): TasksPageTask[] {
  if (includeWorkspaceTasks) {
    return tasks;
  }

  return tasks.filter((task) => task.context === 'life');
}

export function tasksDueOnDate(
  tree: PlannerWorkspaceNode[],
  ymd: string,
): PlannerTask[] {
  return flattenPlannerTasks(tree).filter((task) => task.due_date === ymd);
}
