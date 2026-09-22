import { describe, expect, it } from 'vitest';

import { mergePinnedPlannerTasks } from './merge-pinned-planner-tasks';
import type { PlannerTask } from './types';

function task(
  id: string,
  status: PlannerTask['status'] = 'pending',
): PlannerTask {
  return {
    id,
    title: id,
    project: 'General',
    workspace: 'Studio',
    workspaceSlug: 'studio',
    priority: 'medium',
    status,
    estimated_duration_minutes: null,
    due_date: null,
    dueDateLabel: '',
    notes: null,
    overdue: false,
    context: 'work',
    clientId: null,
    projectId: null,
    areaId: null,
    parentTaskId: null,
    calendarScheduleStatus: null,
    clientName: null,
    accentColor: null,
    workspaceColor: null,
    clientPictureUrl: null,
  };
}

describe('mergePinnedPlannerTasks', () => {
  it('overlays completed status while the task is still in the tree', () => {
    const tree = [
      {
        id: 'ws',
        name: 'Studio',
        taskCount: 1,
        projects: [
          {
            id: 'prj',
            name: 'General',
            taskCount: 1,
            tasks: [task('a')],
            clientPictureUrl: null,
            accentColor: null,
          },
        ],
      },
    ];

    const merged = mergePinnedPlannerTasks(tree, [
      {
        workspace: { id: 'ws', name: 'Studio' },
        project: {
          id: 'prj',
          name: 'General',
          clientPictureUrl: null,
          accentColor: null,
        },
        task: task('a', 'completed'),
      },
    ]);

    expect(merged[0]?.projects[0]?.tasks[0]?.status).toBe('completed');
    expect(merged[0]?.projects[0]?.tasks).toHaveLength(1);
  });

  it('puts a dropped task back in its project', () => {
    const merged = mergePinnedPlannerTasks(
      [],
      [
        {
          workspace: { id: 'ws', name: 'Studio' },
          project: {
            id: 'prj',
            name: 'General',
            clientPictureUrl: null,
            accentColor: null,
          },
          task: task('a', 'completed'),
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.taskCount).toBe(1);
    expect(merged[0]?.projects[0]?.tasks[0]?.id).toBe('a');
    expect(merged[0]?.projects[0]?.tasks[0]?.status).toBe('completed');
  });
});
