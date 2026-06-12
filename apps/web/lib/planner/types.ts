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
  dayViewHref: string;
  planViewHref: string;
  settingsHref: string;
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
  sopSuggestions: SopSuggestion[];
  /** Saved day plan for today (from the database), if one exists. */
  planMarkdown: string | null;
  planViewHref: string;
  settingsHref: string;
};
