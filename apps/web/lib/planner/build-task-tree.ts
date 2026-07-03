import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

import type {
  PlannerProjectNode,
  PlannerScope,
  PlannerTask,
  PlannerWorkspaceNode,
} from './types';

const GENERIC_WORKSPACE_NAMES = new Set(['workspace', 'work']);

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

function workspaceLabel(task: TasksPageTask, scope?: PlannerScope) {
  if (task.workspaceName?.trim()) {
    return task.workspaceName.trim();
  }

  if (scope?.kind === 'workspace') {
    if (
      task.context === 'work' ||
      task.areaLabel?.trim().toLowerCase() === 'workspace'
    ) {
      return scope.accountName;
    }
  }

  const area = task.areaLabel?.trim();
  if (area && task.context !== 'work') {
    return area;
  }

  if (task.context === 'work') {
    return scope?.kind === 'workspace' ? scope.accountName : 'Workspace';
  }

  return area ?? 'Personal';
}

function isGenericProjectName(name: string) {
  return name.trim().toLowerCase() === 'general';
}

function projectLabel(task: TasksPageTask) {
  const project = task.projectName?.trim();
  const client = task.clientName?.trim();
  const area = task.areaLabel?.trim();

  if (project && !isGenericProjectName(project)) {
    return project;
  }
  if (client) {
    return client;
  }
  if (project) {
    return project;
  }
  if (area) {
    return area;
  }
  return 'No project';
}

/** Subtitle under task titles in planner surfaces (Today, trees, etc.). */
export function plannerTaskSubtitle(task: PlannerTask): string {
  const parts: string[] = [];

  const assignment = plannerTaskAssignmentLabel(task);
  const workspace = task.workspace.trim();

  if (
    workspace &&
    workspace !== 'Personal' &&
    workspace !== assignment
  ) {
    parts.push(workspace);
  }

  if (assignment) {
    parts.push(assignment);
  }

  return parts.join(' · ');
}

export function plannerTaskAssignmentLabel(task: PlannerTask): string | null {
  const client = task.clientName?.trim();
  const project = task.project?.trim();

  if (client && project && !isGenericProjectName(project) && project !== client) {
    return `${client} · ${project}`;
  }
  if (client) {
    return client;
  }
  if (project && project !== 'No project') {
    return isGenericProjectName(project) ? null : project;
  }
  return null;
}

export function toPlannerTask(
  task: TasksPageTask,
  scope?: PlannerScope,
): PlannerTask {
  return {
    id: task.id,
    title: task.title,
    project: projectLabel(task),
    workspace: workspaceLabel(task, scope),
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

function mergeProjectsInto(
  target: PlannerWorkspaceNode,
  source: PlannerWorkspaceNode,
): PlannerWorkspaceNode {
  const projects = target.projects.map((project) => ({
    ...project,
    tasks: [...project.tasks],
  }));

  for (const project of source.projects) {
    const existing = projects.find((entry) => entry.id === project.id);
    if (existing) {
      existing.tasks.push(...project.tasks);
      existing.taskCount += project.taskCount;
    } else {
      projects.push({
        ...project,
        tasks: [...project.tasks],
      });
    }
  }

  return {
    ...target,
    taskCount: target.taskCount + source.taskCount,
    projects: projects
      .map((project) => ({
        ...project,
        tasks: project.tasks.sort(sortPlannerTasks),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Fold generic "Workspace" buckets into the real team workspace when unambiguous. */
function mergeAmbiguousWorkspaceNodes(
  nodes: PlannerWorkspaceNode[],
): PlannerWorkspaceNode[] {
  const generic = nodes.filter((node) =>
    GENERIC_WORKSPACE_NAMES.has(node.name.trim().toLowerCase()),
  );
  if (generic.length === 0) {
    return nodes;
  }

  const namedWorkspaces = nodes.filter(
    (node) =>
      !GENERIC_WORKSPACE_NAMES.has(node.name.trim().toLowerCase()) &&
      node.name.trim().toLowerCase() !== 'personal',
  );

  if (namedWorkspaces.length !== 1) {
    return nodes;
  }

  const target = namedWorkspaces[0];
  let merged = target;
  for (const bucket of generic) {
    merged = mergeProjectsInto(merged, bucket);
  }

  const genericIds = new Set(generic.map((node) => node.id));
  return nodes
    .filter((node) => node.id === merged.id || !genericIds.has(node.id))
    .map((node) => (node.id === merged.id ? merged : node))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildTaskTree(
  tasks: TasksPageTask[],
  scope?: PlannerScope,
): PlannerWorkspaceNode[] {
  const workspaces = new Map<string, PlannerWorkspaceNode>();

  for (const task of tasks.filter(isOpenTask)) {
    const plannerTask = toPlannerTask(task, scope);
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

  const tree = [...workspaces.values()]
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

  return mergeAmbiguousWorkspaceNodes(tree);
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
