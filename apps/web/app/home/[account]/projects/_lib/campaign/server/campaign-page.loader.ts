import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';

import { createCampaignProjectsService } from './campaign-projects.service';

export const loadCampaignsPageData = cache(async (accountSlug: string) => {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const service = createCampaignProjectsService(getSupabaseServerClient());
  const projects = await service.listProjects({ accountId });

  return {
    accountId,
    accountSlug,
    projects,
    canEdit: access.canEditProjects,
  };
});

export const loadCampaignDetailPageData = cache(
  async (accountSlug: string, projectId: string) => {
    const workspace = await loadTeamWorkspace(accountSlug);
    const accountId = workspace.account.id as string;
    const access = getTeamAccountAccess(
      workspace.account as {
        permissions?: string[] | null;
        role?: string | null;
        company_role?: string | null;
      },
    );

    const service = createCampaignProjectsService(getSupabaseServerClient());
    const [project, linkOptions] = await Promise.all([
      service.getProject({ accountId, projectId }),
      service.listLinkOptions(accountId),
    ]);

    return {
      accountId,
      accountSlug,
      project,
      linkOptions,
      canEdit: access.canEditProjects,
    };
  },
);
