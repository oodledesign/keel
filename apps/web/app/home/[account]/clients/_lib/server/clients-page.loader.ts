import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import pathsConfig from '~/config/paths.config';
import { createClientsService } from './clients.service';

export async function loadClientsPageData(accountSlug: string) {
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
  const canViewClients =
    access.canViewClients &&
    isWorkModuleEnabled(workspace.moduleSettings, 'clients');
  const canEditClients = access.canEditClients;

  let initialClients: Array<Record<string, unknown>> = [];
  let initialTotal = 0;
  if (canViewClients) {
    try {
      const client = getSupabaseServerClient();
      const service = createClientsService(client);
      const result = await service.listClients({
        accountId: account.id,
        page: 1,
        pageSize: 20,
      });
      initialClients = (result.data ?? []) as Array<Record<string, unknown>>;
      initialTotal = result.total ?? 0;
    } catch (e) {
      console.error('[clients-page.loader] listClients error:', e);
    }
  }

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    user: workspace.user,
    canViewClients,
    canEditClients,
    isContractorView: access.isContractor,
    initialClients,
    initialTotal,
  };
}
