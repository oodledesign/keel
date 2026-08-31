import { describe, expect, it } from 'vitest';

import { filterRecorderTodayByWorkspace } from './today-filter';
import type { NativeWorkspace } from './workspace-shared';

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'studio',
  name: 'Studio',
  profile: 'work_design',
  isPersonal: false,
};

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
};

function task(overrides: {
  id: string;
  account_id: string | null;
  workspace_slug: string | null;
}) {
  return {
    id: overrides.id,
    title: overrides.id,
    status: 'pending' as const,
    priority: 'medium' as const,
    due_date: '2026-08-31',
    due_date_label: 'Mon 31 Aug',
    overdue: false,
    workspace_name: 'Studio',
    workspace_slug: overrides.workspace_slug,
    client_name: null,
    project_name: null,
    subtitle: null,
    detail_path: '/home/tasks',
    account_id: overrides.account_id,
  };
}

describe('filterRecorderTodayByWorkspace', () => {
  const payload = {
    date: '2026-08-31',
    planner_day_path: '/home/planner',
    tasks_path: '/home/tasks',
    tasks_due_today: [
      task({
        id: 'studio-due',
        account_id: studio.id,
        workspace_slug: 'studio',
      }),
      task({ id: 'personal-due', account_id: null, workspace_slug: null }),
    ],
    overdue_tasks: [
      task({
        id: 'studio-overdue',
        account_id: studio.id,
        workspace_slug: 'studio',
      }),
    ],
    all_open_tasks: [
      task({
        id: 'studio-due',
        account_id: studio.id,
        workspace_slug: 'studio',
      }),
      task({ id: 'personal-due', account_id: null, workspace_slug: null }),
    ],
  };

  it('keeps only tasks for the requested workspace', () => {
    const filtered = filterRecorderTodayByWorkspace(payload, studio);

    expect(filtered.tasks_due_today.map((item) => item.id)).toEqual([
      'studio-due',
    ]);
    expect(filtered.overdue_tasks.map((item) => item.id)).toEqual([
      'studio-overdue',
    ]);
    expect(filtered.all_open_tasks.map((item) => item.id)).toEqual([
      'studio-due',
    ]);
  });

  it('keeps personal tasks when the personal workspace is selected', () => {
    const filtered = filterRecorderTodayByWorkspace(payload, personal);

    expect(filtered.tasks_due_today.map((item) => item.id)).toEqual([
      'personal-due',
    ]);
  });
});
