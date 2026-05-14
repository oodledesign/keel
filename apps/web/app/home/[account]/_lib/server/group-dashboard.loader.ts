import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { toIsoDateString } from '../../../_lib/due-date-ymd';

export type GroupProject = {
  id: string;
  name: string;
  openTaskCount: number;
};

export type GroupMember = {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
};

export type GroupTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string | null;
};

export type GroupDashboardData = {
  projects: GroupProject[];
  members: GroupMember[];
  recentTasks: GroupTask[];
};

export const loadGroupDashboardData = cache(
  async (accountSlug: string): Promise<GroupDashboardData> => {
    const client = getSupabaseServerClient();

    // Resolve account_id from slug
    const { data: accountRow } = await client
      .from('accounts')
      .select('id')
      .eq('slug', accountSlug)
      .maybeSingle();

    const accountId = (accountRow as { id?: string } | null)?.id;
    if (!accountId) {
      return { projects: [], members: [], recentTasks: [] };
    }

    const [projectsResult, membersResult] = await Promise.all([
      client
        .from('projects')
        .select('id, name')
        .eq('account_id', accountId)
        .not('status', 'in', '("completed","cancelled","archived")')
        .order('name'),
      client.rpc('get_account_members', { account_slug: accountSlug }),
    ]);

    const projectRows = (projectsResult.data ?? []) as Array<{
      id: string;
      name?: string | null;
    }>;

    // Fetch task counts per project
    const projects: GroupProject[] = await Promise.all(
      projectRows.map(async (p) => {
        const { count } = await client
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', p.id)
          .is('parent_task_id', null)
          .not('status', 'eq', 'done');
        return {
          id: p.id,
          name: p.name ?? 'Untitled',
          openTaskCount: count ?? 0,
        };
      }),
    );

    // Members
    type MemberRpcRow = {
      id?: string;
      display_name?: string | null;
      email?: string | null;
      role?: string | null;
      avatar_url?: string | null;
    };
    const members: GroupMember[] = ((membersResult.data ?? []) as MemberRpcRow[]).map(
      (m) => ({
        id: m.id ?? '',
        displayName: m.display_name?.trim() || m.email || 'Member',
        email: m.email ?? null,
        role: m.role ?? 'member',
        avatarUrl: m.avatar_url ?? null,
      }),
    );

    // Recent tasks (last 20, all projects in this account)
    const projectIds = projectRows.map((p) => p.id);
    let recentTasks: GroupTask[] = [];
    if (projectIds.length > 0) {
      const { data: taskRows } = await client
        .from('tasks')
        .select('id, title, status, priority, due_date, project_id')
        .in('project_id', projectIds)
        .is('parent_task_id', null)
        .not('status', 'eq', 'done')
        .order('due_date', { ascending: true, nullsLast: true })
        .limit(20);

      const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? 'Project']));

      recentTasks = ((taskRows ?? []) as Array<{
        id: string;
        title?: string | null;
        status?: string | null;
        priority?: string | null;
        due_date?: string | null;
        project_id?: string | null;
      }>).map((t) => ({
        id: t.id,
        title: t.title ?? 'Untitled',
        status: t.status ?? 'todo',
        priority: t.priority ?? 'medium',
        dueDate: toIsoDateString(t.due_date),
        projectName: t.project_id ? (projectNameMap.get(t.project_id) ?? null) : null,
      }));
    }

    return { projects, members, recentTasks };
  },
);
