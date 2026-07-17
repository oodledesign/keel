import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import type { PlannerPageData, PlannerTask } from '~/lib/planner/types';

export type PlanningMode = 'day' | 'week';
export type DeepWorkPreference = 'morning' | 'afternoon' | 'none';

export type PlannerPreferences = {
  workingHours: {
    start: string;
    end: string;
  };
  deepWorkPreference: DeepWorkPreference;
  userContext: string;
};

export type PlannerPayloadTask = {
  id: string;
  title: string;
  project: string;
  workspace: string;
  priority: string;
  status: string;
  estimated_duration_minutes: number | null;
  due_date: string | null;
  notes: string | null;
};

export type PlannerGeneratePayload = {
  planning_mode: PlanningMode;
  date: string;
  working_hours: PlannerPreferences['workingHours'];
  deep_work_preference: DeepWorkPreference;
  user_context: string;
  calendar_events: Array<Omit<PlannerCalendarEvent, 'id'>>;
  tasks: PlannerPayloadTask[];
  replan?: {
    current_time: string;
    existing_plan_markdown: string;
    notes: string;
  };
};

export type PlannerPageClientProps = {
  initialData: PlannerPageData;
};

export function plannerTaskToPayload(task: PlannerTask): PlannerPayloadTask {
  return {
    id: task.id,
    title: task.title,
    project: task.project,
    workspace: task.workspace,
    priority: task.priority,
    status: task.status,
    estimated_duration_minutes: task.estimated_duration_minutes,
    due_date: task.due_date,
    notes: task.notes,
  };
}
