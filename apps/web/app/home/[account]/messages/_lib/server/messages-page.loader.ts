import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { isWorkNavModuleEnabled } from '../../../_lib/server/account-modules';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
  isInternalTeamMessageRole,
} from '../../../_lib/role-access';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { loadMessageClientOptions } from './messages-client-directory';
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
  const [threads, membersRes, jobsRes] = await Promise.all([
    service.listThreads({
      accountId: account.id,
      userId: workspace.user.id,
      limit: 20,
    }),
    admin
      .from('accounts_memberships')
      .select('user_id, account_role')
      .eq('account_id', account.id),
    admin
      .from('jobs')
      .select('id, title')
      .eq('account_id', account.id)
      .order('updated_at', { ascending: false })
      .limit(300),
  ]);

  const clientOptions = access.canMessageClients
    ? await loadMessageClientOptions(admin, account.id)
    : [];

  const userIds = Array.from(
    new Set((membersRes.data ?? []).map((m: any) => m.user_id).filter(Boolean)),
  ) as string[];
  const users = userIds.length
    ? (
        await getSupabaseServerAdminClient().auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
      ).data.users.filter((u) => userIds.includes(u.id))
    : [];
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? '']));

  const memberOptions = (membersRes.data ?? [])
    .filter((m: { account_role: string | null }) =>
      access.canMessageClients
        ? true
        : isInternalTeamMessageRole(m.account_role),
    )
    .map((m: any) => ({
      userId: m.user_id as string,
      role: m.account_role as string | null,
      email: userEmailMap.get(m.user_id as string) ?? 'Unknown',
    }));

  const jobOptions = (jobsRes.data ?? []).map((j: any) => ({
    id: j.id as string,
    title: (j.title as string)?.trim() || 'Untitled job',
  }));

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    userId: workspace.user.id,
    canMessageClients: access.canMessageClients,
    threads,
    memberOptions,
    clientOptions,
    jobOptions,
  };
}
