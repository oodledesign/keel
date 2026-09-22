import type { PlannerTask, PlannerWorkspaceNode } from './types';

export type PinnedPlannerTask = {
  workspace: { id: string; name: string };
  project: {
    id: string;
    name: string;
    clientPictureUrl: string | null;
    accentColor: string | null;
  };
  task: PlannerTask;
};

/** Keep tasks completed in this session inside the planner tree after refresh. */
export function mergePinnedPlannerTasks(
  tree: readonly PlannerWorkspaceNode[],
  pinned: readonly PinnedPlannerTask[],
): PlannerWorkspaceNode[] {
  if (pinned.length === 0) return tree as PlannerWorkspaceNode[];

  const byId = new Map(pinned.map((pin) => [pin.task.id, pin]));
  const placed = new Set<string>();

  const next: PlannerWorkspaceNode[] = tree.map((workspace) => ({
    ...workspace,
    projects: workspace.projects.map((project) => {
      const tasks = project.tasks.map((task) => {
        const pin = byId.get(task.id);
        if (!pin) return task;
        placed.add(task.id);
        return pin.task;
      });
      return {
        ...project,
        tasks,
        taskCount: tasks.length,
      };
    }),
  }));

  for (const pin of pinned) {
    if (placed.has(pin.task.id)) continue;

    let workspace = next.find((entry) => entry.id === pin.workspace.id);
    if (!workspace) {
      workspace = {
        id: pin.workspace.id,
        name: pin.workspace.name,
        taskCount: 0,
        projects: [],
      };
      next.push(workspace);
    }

    let project = workspace.projects.find(
      (entry) => entry.id === pin.project.id,
    );
    if (!project) {
      project = {
        id: pin.project.id,
        name: pin.project.name,
        taskCount: 0,
        tasks: [],
        clientPictureUrl: pin.project.clientPictureUrl,
        accentColor: pin.project.accentColor,
      };
      workspace.projects = [...workspace.projects, project];
    }

    project.tasks = [...project.tasks, pin.task];
    project.taskCount = project.tasks.length;
    placed.add(pin.task.id);
  }

  return next.map((workspace) => ({
    ...workspace,
    taskCount: workspace.projects.reduce(
      (sum, project) => sum + project.tasks.length,
      0,
    ),
  }));
}
