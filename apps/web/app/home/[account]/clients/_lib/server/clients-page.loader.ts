import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import type { ClientOverviewItem } from '../clients-overview.types';
import { createClientsService } from './clients.service';

export const loadClientsPageData = cache(loadClientsPageDataImpl);

async function loadClientsPageDataImpl(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

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

  let initialOverview: ClientOverviewItem[] = [];
  let initialTotal = 0;
  if (canViewClients) {
    try {
      const client = getSupabaseServerClient();
      const service = createClientsService(client);

      const result = await service.listClientsOverview({
        accountId: account.id,
        accountSlug: account.slug ?? accountSlug,
        page: 1,
        pageSize: 20,
      });
      initialOverview = result.data;
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
    initialOverview,
    initialTotal,
  };
}
