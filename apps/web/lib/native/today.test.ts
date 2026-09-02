import { describe, expect, it } from 'vitest';

import { NATIVE_MEETING_NOTE_CATEGORY, type NativeNote } from './notes-shared';
import type { NativeTask } from './task-map';
import { filterRecorderTodayByWorkspace } from './today-filter';
import {
  buildNativeTodayHomePayload,
  mergeNativeTodayItems,
  nativeTodayDateParts,
  nativeTodaySupportingMessage,
  pickNativeTodayNotes,
  splitNativeTodayTasks,
} from './today-home';
import type { NativeWorkspace } from './workspace-shared';

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'studio',
  name: 'Studio',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
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

function nativeTask(
  overrides: Partial<NativeTask> & { id: string },
): NativeTask {
  return {
    title: overrides.title ?? overrides.id,
    status: overrides.status ?? 'pending',
    due: overrides.due ?? null,
    workspace: overrides.workspace ?? 'oodle',
    client_id: overrides.client_id ?? null,
    client_name: overrides.client_name ?? null,
    ...overrides,
  };
}

function note(overrides: Partial<NativeNote> & { id: string }): NativeNote {
  return {
    title: overrides.title ?? overrides.id,
    body: overrides.body ?? 'Body',
    workspace: overrides.workspace ?? 'oodle',
    category: overrides.category ?? 'idea',
    tags: overrides.tags ?? [],
    client_id: overrides.client_id ?? null,
    created_at: overrides.created_at ?? '2026-09-01T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-09-01T10:00:00.000Z',
    ...overrides,
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

describe('splitNativeTodayTasks', () => {
  it('splits due today and overdue, ignoring later and undated', () => {
    const { dueToday, overdue } = splitNativeTodayTasks(
      [
        nativeTask({ id: 'today', due: '2026-09-01', client_name: 'Hope' }),
        nativeTask({ id: 'late', due: '2026-08-30' }),
        nativeTask({ id: 'later', due: '2026-09-10' }),
        nativeTask({ id: 'none', due: null }),
      ],
      '2026-09-01',
    );

    expect(dueToday.map((item) => item.id)).toEqual(['today']);
    expect(overdue.map((item) => item.id)).toEqual(['late']);
  });
});

describe('pickNativeTodayNotes', () => {
  it('keeps recent notes and today meeting transcripts separately', () => {
    const { recentNotes, meetingsToday } = pickNativeTodayNotes(
      [
        note({ id: 'meet', category: NATIVE_MEETING_NOTE_CATEGORY }),
        note({ id: 'idea', title: 'Site note' }),
        note({
          id: 'old-meet',
          category: NATIVE_MEETING_NOTE_CATEGORY,
          created_at: '2026-08-01T10:00:00.000Z',
        }),
      ],
      '2026-09-01',
    );

    expect(recentNotes.map((item) => item.id)).toEqual(['idea']);
    expect(meetingsToday.map((item) => item.id)).toEqual(['meet']);
  });
});

describe('buildNativeTodayHomePayload', () => {
  it('adds greeting, items merge, and optional finances', () => {
    const due = nativeTask({
      id: 'today',
      title: 'Call Dan',
      due: '2026-09-01',
      client_name: 'Hope',
    });
    const late = nativeTask({
      id: 'late',
      title: 'Send invoice',
      due: '2026-08-30',
    });

    const payload = buildNativeTodayHomePayload({
      greeting: 'Good morning',
      date: '2026-09-01',
      dateLabel: 'Tue 1 Sep',
      dueToday: [due],
      overdue: [late],
      recentNotes: [note({ id: 'n1', title: 'Site note' })],
      meetingsToday: [
        {
          id: 'm1',
          title: 'Site visit',
          created_at: '2026-09-01T10:00:00.000Z',
        },
      ],
      finances: {
        outstanding_balance: '£125.00',
        outstanding_balance_pence: 12500,
        overdue_count: 1,
        overdue_amount: '£50.00',
        overdue_amount_pence: 5000,
        paid_this_month: null,
        paid_this_month_pence: null,
        currency: 'gbp',
        recent: [],
      },
    });

    expect(payload.greeting).toBe('Good morning');
    expect(payload.message).toBe('1 due today · 1 overdue');
    expect(payload.items).toEqual([
      { id: 'today', title: 'Call Dan', subtitle: '2026-09-01 · Hope' },
      { id: 'late', title: 'Send invoice', subtitle: '2026-08-30' },
    ]);
    expect(payload.finances?.outstanding_balance_pence).toBe(12500);
    expect(mergeNativeTodayItems([due], [late])).toHaveLength(2);
    expect(
      nativeTodaySupportingMessage({ dueTodayCount: 0, overdueCount: 0 }),
    ).toBeNull();
  });
});

describe('nativeTodayDateParts', () => {
  it('formats a local calendar date', () => {
    const parts = nativeTodayDateParts(new Date('2026-09-01T12:00:00+01:00'));
    expect(parts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts.date_label.length).toBeGreaterThan(3);
  });
});
