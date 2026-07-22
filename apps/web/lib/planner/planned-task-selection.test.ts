import { describe, expect, it } from 'vitest';

import {
  resolvePlannedTasks,
  taskTitlesFromPlanMarkdown,
} from './planned-task-selection';
import type { PlannerTask } from './types';

function task(
  id: string,
  title: string,
  status: PlannerTask['status'] = 'pending',
): PlannerTask {
  return {
    id,
    title,
    status,
    project: 'Test',
    workspace: 'Work',
    workspaceSlug: null,
    priority: 'medium',
    estimated_duration_minutes: 30,
    due_date: null,
    dueDateLabel: '',
    notes: null,
    overdue: false,
    context: 'work',
    clientId: null,
    projectId: 'proj-1',
    areaId: null,
    parentTaskId: null,
    calendarScheduleStatus: null,
    clientName: null,
    accentColor: null,
    workspaceColor: null,
    clientPictureUrl: null,
  };
}

describe('taskTitlesFromPlanMarkdown', () => {
  it('returns scheduled task titles and excludes calendar events and breaks', () => {
    const markdown = `## Today's Plan — Tue 22 Jul

### Morning
9am–9:30am · 📅 Daily standup
10am–11am · Write proposal · Oodle · ~60min
12pm–12:30pm · Lunch break
1pm–2pm · Reply to Sarah · Oodle · ~30min
`;

    expect(
      taskTitlesFromPlanMarkdown(markdown, '2026-07-22T12:00:00'),
    ).toEqual(['Write proposal', 'Reply to Sarah']);
  });
});

describe('resolvePlannedTasks', () => {
  const available = [
    task('a', 'Write proposal'),
    task('b', 'Reply to Sarah'),
    task('c', 'Admin inbox'),
    task('d', 'Old task', 'completed'),
  ];

  it('prefers stored task ids over markdown title matching', () => {
    expect(
      resolvePlannedTasks(available, {
        storedTaskIds: ['a', 'c'],
        planMarkdown: '10am · Reply to Sarah',
        dateIso: '2026-07-22T12:00:00',
      }).map((item) => item.id),
    ).toEqual(['a', 'c']);
  });

  it('falls back to matching titles from plan markdown when ids are missing', () => {
    expect(
      resolvePlannedTasks(available, {
        planMarkdown: `### Morning
10am–11am · Write proposal · Oodle · ~60min
1pm–2pm · Reply to Sarah · Oodle · ~30min
`,
        dateIso: '2026-07-22T12:00:00',
      }).map((item) => item.id),
    ).toEqual(['a', 'b']);
  });

  it('returns all open tasks when no ids or markdown titles are available', () => {
    expect(
      resolvePlannedTasks(available, {}).map((item) => item.id),
    ).toEqual(['a', 'b', 'c']);
  });
});
