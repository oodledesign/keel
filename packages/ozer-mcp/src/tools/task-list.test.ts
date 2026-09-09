import { describe, expect, it } from 'vitest';

import { OPEN_TASK_STATUSES } from './shared';
import {
  TASK_LIST_DEFAULT_LIMIT,
  TASK_LIST_MAX_LIMIT,
  buildTaskListHint,
  ilikeContains,
  listTasksSchema,
  resolveTaskListStatuses,
  shouldRestrictToRootTasks,
  sortTaskRows,
} from './task-list';

describe('listTasksSchema', () => {
  it('defaults to outstanding current work without client or project filters', () => {
    const parsed = listTasksSchema.parse({});

    expect(parsed).toMatchObject({
      status: 'outstanding',
      sort: 'updated',
      include_subtasks: false,
      mine: false,
      limit: TASK_LIST_DEFAULT_LIMIT,
      offset: 0,
    });
    expect(parsed.client_id).toBeUndefined();
    expect(parsed.project_id).toBeUndefined();
    expect(parsed.account_id).toBeUndefined();
    expect(TASK_LIST_DEFAULT_LIMIT).toBe(100);
    expect(TASK_LIST_MAX_LIMIT).toBe(300);
  });

  it('rejects a limit above the documented page size', () => {
    expect(() => listTasksSchema.parse({ limit: 301 })).toThrow();
  });
});

describe('resolveTaskListStatuses', () => {
  it('maps outstanding to open statuses used by the Ozer tasks page', () => {
    expect(resolveTaskListStatuses('outstanding')).toEqual([
      ...OPEN_TASK_STATUSES,
    ]);
    expect(resolveTaskListStatuses('all')).toBeNull();
    expect(resolveTaskListStatuses('todo')).toEqual(['todo']);
  });
});

describe('shouldRestrictToRootTasks', () => {
  it('hides subtasks unless a parent or include_subtasks is requested', () => {
    expect(shouldRestrictToRootTasks({})).toBe(true);
    expect(shouldRestrictToRootTasks({ include_subtasks: true })).toBe(false);
    expect(
      shouldRestrictToRootTasks({
        parent_task_id: '00000000-0000-0000-0000-000000000001',
      }),
    ).toBe(false);
  });
});

describe('sortTaskRows', () => {
  const staleBacklog = {
    id: 'old',
    priority: 'medium',
    due_date: '2022-01-01',
    updated_at: '2022-01-02T00:00:00Z',
  };
  const currentUrgent = {
    id: 'now',
    priority: 'urgent',
    due_date: '2026-09-12',
    updated_at: '2026-09-09T18:00:00Z',
  };
  const currentMedium = {
    id: 'recent',
    priority: 'medium',
    due_date: null,
    updated_at: '2026-09-08T12:00:00Z',
  };

  it('surfaces recently updated work before an old one-client backlog', () => {
    expect(
      sortTaskRows([staleBacklog, currentMedium, currentUrgent], 'updated').map(
        (row) => row.id,
      ),
    ).toEqual(['now', 'recent', 'old']);
  });

  it('sorts by soonest due date like the Ozer tasks page', () => {
    expect(
      sortTaskRows([currentMedium, currentUrgent, staleBacklog], 'due').map(
        (row) => row.id,
      ),
    ).toEqual(['old', 'now', 'recent']);
  });

  it('ranks urgent current work ahead of older medium todos', () => {
    expect(
      sortTaskRows(
        [staleBacklog, currentMedium, currentUrgent],
        'priority',
      ).map((row) => row.id),
    ).toEqual(['now', 'old', 'recent']);
  });
});

describe('ilikeContains', () => {
  it('escapes SQL LIKE wildcards in the search needle', () => {
    expect(ilikeContains('100% done_now')).toBe('%100\\% done\\_now%');
  });
});

describe('buildTaskListHint', () => {
  it('explains truncation and multi-workspace filtering', () => {
    expect(
      buildTaskListHint({
        truncated: true,
        nextOffset: 100,
        workspaceCount: 3,
      }),
    ).toContain('Pass offset=100 for the next page.');

    expect(
      buildTaskListHint({
        truncated: false,
        nextOffset: null,
        workspaceCount: 3,
      }),
    ).toContain('Pass account_id from list_workspaces');
  });
});
