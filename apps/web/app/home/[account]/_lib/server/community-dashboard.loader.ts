import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';

import type { GroupMember, GroupTask } from './group-dashboard.loader';
import { loadGroupDashboardData } from './group-dashboard.loader';

export type CommunityNextSession = {
  id: string;
  title: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  sessionNotes: string | null;
  location: string | null;
};

export type CommunityDashboardData = {
  accountSlug: string;
  openTasksCount: number;
  upcomingSessionsCount: number;
  membersCount: number;
  overdueCount: number;
  recentTasks: GroupTask[];
  members: GroupMember[];
  nextSession: CommunityNextSession | null;
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

export const loadCommunityDashboardData = cache(
  async (accountSlug: string): Promise<CommunityDashboardData> => {
    const client = getSupabaseServerClient();

    const { data: accountRow } = await client
      .from('accounts')
      .select('id')
      .eq('slug', accountSlug)
      .maybeSingle();

    const accountId = (accountRow as { id?: string } | null)?.id;

    const groupData = await loadGroupDashboardData(accountSlug);

    const openTasksCount = groupData.projects.reduce(
      (sum, p) => sum + p.openTaskCount,
      0,
    );

    let overdueCount = 0;
    if (accountId) {
      const projectIds = groupData.projects.map((p) => p.id);
      if (projectIds.length > 0) {
        const { count, error: overdueError } = await client
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .is('parent_task_id', null)
          .not('status', 'eq', 'done')
          .lt('due_date', todayLocalYmd());

        if (!isTableMissing(overdueError)) {
          overdueCount = count ?? 0;
        }
      }
    }

    let upcomingSessionsCount = 0;
    let nextSession: CommunityNextSession | null = null;

    if (accountId) {
      const nowIso = new Date().toISOString();

      const { count, error: countError } = await client
        .from('account_calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .gte('starts_at', nowIso);

      if (!isTableMissing(countError)) {
        upcomingSessionsCount = count ?? 0;
      }

      const { data: nextRow, error: nextError } = await client
        .from('account_calendar_events')
        .select('id, title, starts_at, location, session_notes')
        .eq('account_id', accountId)
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!isTableMissing(nextError) && nextRow) {
        const startsAt = (nextRow as { starts_at: string }).starts_at;
        const d = new Date(startsAt);
        nextSession = {
          id: (nextRow as { id: string }).id,
          title: ((nextRow as { title?: string }).title ?? 'Session').trim(),
          startsAt,
          dateLabel: d.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          timeLabel: d.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sessionNotes:
            (
              (nextRow as { session_notes?: string | null }).session_notes ?? ''
            ).trim() || null,
          location:
            ((nextRow as { location?: string | null }).location ?? '').trim() ||
            null,
        };
      }
    }

    return {
      accountSlug,
      openTasksCount,
      upcomingSessionsCount,
      membersCount: groupData.members.length,
      overdueCount,
      recentTasks: groupData.recentTasks,
      members: groupData.members,
      nextSession,
    };
  },
);
