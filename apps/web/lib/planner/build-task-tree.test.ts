import { describe, expect, it } from 'vitest';

import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

import {
  plannerTaskAssignmentLabel,
  plannerTaskSubtitle,
  toPlannerTask,
} from './build-task-tree';

function baseTask(overrides: Partial<TasksPageTask> = {}): TasksPageTask {
  return {
    id: 'task-1',
    title: 'Example task',
    projectName: null,
    areaLabel: null,
    context: 'work',
    status: 'pending',
    priority: 'medium',
    dueDateLabel: 'Today',
    dueDate: '2026-07-03',
    accentColor: null,
    clientId: null,
    projectId: null,
    areaId: null,
    clientName: null,
    workspaceName: 'Oodle',
    workspaceSlug: 'oodle',
    workspaceColor: null,
    parentTaskId: null,
    notes: null,
    calendarScheduleStatus: null,
    ...overrides,
  };
}

describe('planner task labels', () => {
  it('uses client name instead of the General fallback', () => {
    const plannerTask = toPlannerTask(
      baseTask({ clientName: 'Bracketts', clientId: 'client-1' }),
    );

    expect(plannerTask.project).toBe('Bracketts');
    expect(plannerTaskSubtitle(plannerTask)).toBe('Oodle · Bracketts');
  });

  it('shows client and project when both exist', () => {
    const plannerTask = toPlannerTask(
      baseTask({
        clientName: 'Bracketts',
        projectName: 'Website refresh',
        projectId: 'project-1',
      }),
    );

    expect(plannerTaskAssignmentLabel(plannerTask)).toBe(
      'Bracketts · Website refresh',
    );
  });
});
