import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  isCalendarOverdueYmd,
  parseDueDateParts,
  todayLocalYmd,
  toIsoDateString,
} from '~/home/_lib/due-date-ymd';

import type { GroupMember } from './group-dashboard.loader';
import { loadGroupDashboardData } from './group-dashboard.loader';

export type FamilyTaskAssignee = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type FamilyUpcomingTask = {
  id: string;
  title: string;
  dueDate: string | null;
  dueLabel: string;
  assignee: FamilyTaskAssignee | null;
  planName: string | null;
};

export type FamilyMealPlanDay = {
  planDate: string;
  dayLabel: string;
  summary: string | null;
};

export type FamilyCalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
};

export type FamilyDashboardData = {
  accountSlug: string;
  openTasksCount: number;
  upcomingPlansCount: number;
  familyMembersCount: number;
  overdueCount: number;
  upcomingTasks: FamilyUpcomingTask[];
  weekMealPlan: FamilyMealPlanDay[];
  upcomingEvents: FamilyCalendarEventItem[];
  members: GroupMember[];
};

function isTableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

function addDaysYmd(ymd: string, days: number): string {
  const p = parseDueDateParts(ymd);
  if (!p) return ymd;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toIsoDateString(d.toISOString()) ?? ymd;
}

function formatDueLabel(due: string | null): string {
  if (!due) return '';
  const today = todayLocalYmd();
  if (due === today) return 'Today';
  const tomorrow = addDaysYmd(today, 1);
  if (due === tomorrow) return 'Tomorrow';
  const p = parseDueDateParts(due);
  if (!p) return due;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function startOfWeekMondayYmd(ref = todayLocalYmd()): string {
  const p = parseDueDateParts(ref);
  if (!p) return ref;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDateString(d.toISOString()) ?? ref;
}

function memberMap(members: GroupMember[]) {
  return new Map(
    members.map((m) => [
      m.id,
      {
        userId: m.id,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
      } satisfies FamilyTaskAssignee,
    ]),
  );
}

export const loadFamilyDashboardData = cache(
  async (accountSlug: string): Promise<FamilyDashboardData> => {
    const client = getSupabaseServerClient();

    const { data: accountRow } = await client
      .from('accounts')
      .select('id')
      .eq('slug', accountSlug)
      .maybeSingle();

    const accountId = (accountRow as { id?: string } | null)?.id;

    const groupData = await loadGroupDashboardData(accountSlug);
    const members = groupData.members;
    const membersById = memberMap(members);

    const openTasksCount = groupData.projects.reduce(
      (sum, p) => sum + p.openTaskCount,
      0,
    );
    const upcomingPlansCount = groupData.projects.length;

    const today = todayLocalYmd();
    const weekEnd = addDaysYmd(today, 7);
    const eventsEnd = addDaysYmd(today, 14);

    let upcomingTasks: FamilyUpcomingTask[] = [];
    let overdueCount = 0;

    if (accountId) {
      const { data: projects } = await client
        .from('projects')
        .select('id, name')
        .eq('account_id', accountId);

      const projectRows = (projects ?? []) as Array<{
        id: string;
        name?: string | null;
      }>;
      const projectIds = projectRows.map((p) => p.id);
      const projectNames = new Map(
        projectRows.map((p) => [p.id, p.name ?? 'Plan']),
      );

      if (projectIds.length > 0) {
        const { data: taskRows } = await client
          .from('tasks')
          .select(
            'id, title, status, due_date, project_id, user_id',
          )
          .in('project_id', projectIds)
          .is('parent_task_id', null)
          .not('status', 'eq', 'done')
          .order('due_date', { ascending: true, nullsFirst: false });

        const rows = (taskRows ?? []) as Array<{
          id: string;
          title?: string | null;
          due_date?: string | null;
          project_id?: string | null;
          user_id?: string | null;
        }>;

        for (const t of rows) {
          const due = toIsoDateString(t.due_date);
          if (due && isCalendarOverdueYmd(due)) {
            overdueCount += 1;
          }
        }

        upcomingTasks = rows
          .filter((t) => {
            const due = toIsoDateString(t.due_date);
            if (!due) return true;
            if (isCalendarOverdueYmd(due)) return true;
            return due <= weekEnd;
          })
          .slice(0, 12)
          .map((t) => {
            const due = toIsoDateString(t.due_date);
            const assignee = t.user_id
              ? (membersById.get(t.user_id) ?? null)
              : null;
            return {
              id: t.id,
              title: t.title ?? 'Untitled task',
              dueDate: due,
              dueLabel: formatDueLabel(due),
              assignee,
              planName: t.project_id
                ? (projectNames.get(t.project_id) ?? null)
                : null,
            };
          });
      }
    }

    const weekStart = startOfWeekMondayYmd(today);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i));
    const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

    let mealByDate = new Map<string, string>();
    if (accountId) {
      const weekEndDate = addDaysYmd(weekStart, 6);
      const { data: meals, error } = await client
        .from('meal_plan_days')
        .select('plan_date, summary')
        .eq('account_id', accountId)
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEndDate);

      if (!isTableMissing(error)) {
        for (const row of meals ?? []) {
          const d = toIsoDateString((row as { plan_date: string }).plan_date);
          if (d) {
            mealByDate.set(d, ((row as { summary?: string }).summary ?? '').trim());
          }
        }
      }
    }

    const weekMealPlan: FamilyMealPlanDay[] = weekDates.map((planDate) => {
      const p = parseDueDateParts(planDate);
      const label = p
        ? dayFormatter.format(new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0))
        : planDate;
      const summary = mealByDate.get(planDate);
      return {
        planDate,
        dayLabel: label,
        summary: summary || null,
      };
    });

    let upcomingEvents: FamilyCalendarEventItem[] = [];
    if (accountId) {
      const nowIso = new Date().toISOString();
      const endIso = new Date();
      const endParts = parseDueDateParts(eventsEnd);
      if (endParts) {
        endIso.setFullYear(endParts.y, endParts.m - 1, endParts.d);
        endIso.setHours(23, 59, 59, 999);
      } else {
        endIso.setDate(endIso.getDate() + 14);
      }

      const { data: events, error } = await client
        .from('account_calendar_events')
        .select('id, title, starts_at')
        .eq('account_id', accountId)
        .gte('starts_at', nowIso)
        .lte('starts_at', endIso.toISOString())
        .order('starts_at', { ascending: true })
        .limit(20);

      if (!isTableMissing(error)) {
        upcomingEvents = (events ?? []).map((e) => {
          const startsAt = (e as { starts_at: string }).starts_at;
          const d = new Date(startsAt);
          return {
            id: (e as { id: string }).id,
            title: ((e as { title?: string }).title ?? 'Event').trim(),
            startsAt,
            dateLabel: d.toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }),
            timeLabel: d.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
        });
      }
    }

    return {
      accountSlug,
      openTasksCount,
      upcomingPlansCount,
      familyMembersCount: members.length,
      overdueCount,
      upcomingTasks,
      weekMealPlan,
      upcomingEvents,
      members,
    };
  },
);
