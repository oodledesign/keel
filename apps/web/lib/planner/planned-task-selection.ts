import { parseDayScheduleFromMarkdown } from './parse-plan-markdown';
import type { PlannerTask } from './types';

function normalizeTaskTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Task titles scheduled in a plan (excludes calendar events and breaks). */
export function taskTitlesFromPlanMarkdown(
  markdown: string,
  dateIso: string,
): string[] {
  return parseDayScheduleFromMarkdown(markdown, dateIso)
    .filter((block) => !block.isCalendarEvent && !block.isBreak)
    .map((block) => block.title.trim())
    .filter(Boolean);
}

/** Resolve the task set originally chosen for a plan (for replan/regenerate). */
export function resolvePlannedTasks(
  availableTasks: PlannerTask[],
  options: {
    storedTaskIds?: string[];
    planMarkdown?: string;
    dateIso?: string;
  },
): PlannerTask[] {
  const byId = new Map<string, PlannerTask>();
  for (const task of availableTasks) {
    byId.set(task.id, task);
  }

  if (options.storedTaskIds && options.storedTaskIds.length > 0) {
    return options.storedTaskIds
      .map((id) => byId.get(id))
      .filter(
        (task): task is PlannerTask =>
          Boolean(task) && task.status !== 'completed',
      );
  }

  if (options.planMarkdown?.trim() && options.dateIso) {
    const titles = new Set(
      taskTitlesFromPlanMarkdown(options.planMarkdown, options.dateIso).map(
        normalizeTaskTitle,
      ),
    );

    if (titles.size > 0) {
      return availableTasks.filter(
        (task) =>
          task.status !== 'completed' &&
          titles.has(normalizeTaskTitle(task.title)),
      );
    }
  }

  return availableTasks.filter((task) => task.status !== 'completed');
}
