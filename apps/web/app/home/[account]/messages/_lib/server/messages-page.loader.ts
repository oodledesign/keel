import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
  isInternalTeamMessageRole,
} from '../../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { loadMessageClientOptions } from './messages-client-directory';
import { loadMessageContactOptions } from './messages-participants';
import { createMessagesService } from './messages.service';

export async function loadMessagesPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);
  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const account = workspace.account as {
    id: string;
    slug: string | null;
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const access = getTeamAccountAccess(account);
  const canViewMessages = access.canViewMessages;

  if (
    !canViewMessages ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'messages')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const admin = getSupabaseServerAdminClient();
  const service = createMessagesService();
  const [threads, membersRes, projectsRes] = await Promise.all([
    service.listThreads({
      accountId: account.id,
      userId: workspace.user.id,
      limit: 40,
    }),
    admin
      .from('accounts_memberships')
      .select('user_id, account_role')
      .eq('account_id', account.id),
    admin
      .from('projects')
      .select('id, name, title, client_id')
      .eq('account_id', account.id)
      .order('updated_at', { ascending: false })
      .limit(300),
  ]);

  const projectRows = (projectsRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    title: string | null;
    client_id: string | null;
  }>;
  const projectIds = projectRows.map((project) => project.id);
  const { data: assignmentRows } =
    projectIds.length > 0
      ? await admin
          .from('project_assignments')
          .select('project_id, user_id')
          .in('project_id', projectIds)
      : { data: [] as Array<{ project_id: string; user_id: string }> };

  const [clientOptions, contactOptions] = access.canMessageClients
    ? await Promise.all([
        loadMessageClientOptions(admin, account.id),
        loadMessageContactOptions(admin, account.id),
      ])
    : [[], []];

  const memberships = (membersRes.data ?? []) as Array<{
    user_id: string;
    account_role: string | null;
  }>;
  const userIds = Array.from(
    new Set(memberships.map((m) => m.user_id).filter(Boolean)),
  );
  const users = userIds.length
    ? (
        await getSupabaseServerAdminClient().auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
      ).data.users.filter((u) => userIds.includes(u.id))
    : [];
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? '']));

  const userNameMap = new Map(
    users.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const first = String(meta.first_name ?? '').trim();
      const last = String(meta.last_name ?? '').trim();
      const fromParts = [first, last].filter(Boolean).join(' ').trim();
      const name =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        fromParts ||
        u.email ||
        'Team member';
      return [u.id, name] as const;
    }),
  );

  const memberOptions = memberships
    .filter((m) =>
      access.canMessageClients
        ? true
        : isInternalTeamMessageRole(m.account_role),
    )
    .map((m) => ({
      userId: m.user_id,
      role: m.account_role,
      email: userEmailMap.get(m.user_id) ?? 'Unknown',
      name:
        userNameMap.get(m.user_id) ??
        userEmailMap.get(m.user_id) ??
        'Team member',
    }));

  const assigneesByProject = new Map<string, string[]>();
  for (const row of (assignmentRows ?? []) as Array<{
    project_id: string;
    user_id: string;
  }>) {
    const list = assigneesByProject.get(row.project_id) ?? [];
    list.push(row.user_id);
    assigneesByProject.set(row.project_id, list);
  }

  const jobOptions = projectRows.map((project) => ({
    id: project.id,
    title: deliveryProjectTitle(project),
    clientId: project.client_id,
    assigneeUserIds: assigneesByProject.get(project.id) ?? [],
  }));

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    userId: workspace.user.id,
    canMessageClients: access.canMessageClients,
    threads,
    memberOptions,
    clientOptions,
    contactOptions,
    jobOptions,
  };
}
