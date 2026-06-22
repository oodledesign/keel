import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

export type PlannerTask = {
  id: string;
  title: string;
  project: string;
  workspace: string;
  workspaceSlug: string | null;
  priority: TasksPageTask['priority'];
  status: TasksPageTask['status'];
  estimated_duration_minutes: number | null;
  due_date: string | null;
  dueDateLabel: string;
  notes: string | null;
  overdue: boolean;
  context: 'work' | 'life';
  clientId: string | null;
  projectId: string | null;
  areaId: string | null;
  parentTaskId: string | null;
  calendarScheduleStatus: TasksPageTask['calendarScheduleStatus'];
  clientName: string | null;
  accentColor: string | null;
  workspaceColor: string | null;
};

export type PlannerProjectNode = {
  id: string;
  name: string;
  taskCount: number;
  tasks: PlannerTask[];
};

export type PlannerWorkspaceNode = {
  id: string;
  name: string;
  taskCount: number;
  projects: PlannerProjectNode[];
};

export type PlannerScope =
  | { kind: 'personal' }
  | {
      kind: 'workspace';
      accountId: string;
      accountSlug: string;
      accountName: string;
    };

export type SopSuggestion = {
  id: string;
  title: string;
  href: string;
  reason: string;
};

export type PlannerPageData = {
  userId: string;
  scope: PlannerScope;
  includeWorkspaceTasks: boolean;
  calendar: {
    connected: boolean;
    configured: boolean;
  };
  taskTree: PlannerWorkspaceNode[];
  sopSuggestions: SopSuggestion[];
  /** Saved day plan for today (from the database), if one exists. */
  savedPlanMarkdown: string | null;
  savedPlanUpdatedAt: string | null;
  dayViewHref: string;
  planViewHref: string;
  settingsHref: string;
};

export type DayViewPipelineStage = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export type DayViewPipelineDeal = {
  id: string;
  name: string;
  stageLabel: string;
  nextAction: string;
  nextActionDate: string | null;
  overdue: boolean;
  value: number;
};

export type DayViewPipeline = {
  href: string;
  openCount: number;
  openValue: number;
  stages: DayViewPipelineStage[];
  /** Deals whose next action is due today or overdue. */
  needsAction: DayViewPipelineDeal[];
};

export type DayViewData = {
  userId: string;
  scope: PlannerScope;
  includeWorkspaceTasks: boolean;
  calendar: {
    connected: boolean;
    configured: boolean;
  };
  tasksDueToday: PlannerTask[];
  /** Open tasks in scope — used when re-planning the rest of the day. */
  openTasksForReplan: PlannerTask[];
  sopSuggestions: SopSuggestion[];
  /** Saved day plan for today (from the database), if one exists. */
  planMarkdown: string | null;
  planUpdatedAt: string | null;
  /** Compact pipeline overview, when the scope has an active pipeline. */
  pipeline: DayViewPipeline | null;
  planViewHref: string;
  settingsHref: string;
};
