import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { workspacePageBodyClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { withI18n } from '~/lib/i18n/with-i18n';
import type { WorkspaceRetainerStatusFilter } from '~/lib/retainers/workspace-retainers';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkNavModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { RetainersPageContent } from './_components/retainers-page-content';
import { createWorkspaceRetainersService } from './_lib/server/workspace-retainers.service';

interface RetainersPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ status?: string }>;
}

export const generateMetadata = () => {
  return { title: 'Retainers' };
};

function parseStatus(value: string | undefined): WorkspaceRetainerStatusFilter {
  if (value === 'active' || value === 'pending' || value === 'cancelled') {
    return value;
  }
  return 'all';
}

async function RetainersPage({ params, searchParams }: RetainersPageProps) {
  const accountSlug = (await params).account;
  const status = parseStatus((await searchParams).status);
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewClients ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'retainers')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const data = await createWorkspaceRetainersService(
    getSupabaseServerClient(),
  ).list(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Retainers"
        description="All project retainers across this workspace"
        account={accountSlug}
      />

      <PageBody className={cn(workspacePageBodyClassName, 'py-4 md:py-6')}>
        <RetainersPageContent
          accountId={accountId}
          accountSlug={accountSlug}
          canEdit={access.canEditClients}
          initialRows={data.rows}
          initialClients={data.clients}
          initialProjects={data.projects}
          initialStatus={status}
        />
      </PageBody>
    </>
  );
}

export default withI18n(RetainersPage);
