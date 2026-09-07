import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

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
  const [threads, membersRes, jobsRes] = await Promise.all([
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
      .from('jobs')
      .select('id, title')
      .eq('account_id', account.id)
      .order('updated_at', { ascending: false })
      .limit(300),
  ]);

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
    }));

  const jobOptions = (
    (jobsRes.data ?? []) as Array<{ id: string; title: string | null }>
  ).map((j) => ({
    id: j.id,
    title: j.title?.trim() || 'Untitled job',
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
