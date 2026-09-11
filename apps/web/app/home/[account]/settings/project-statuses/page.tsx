import { redirect } from 'next/navigation';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';
import { fallbackProjectStatuses } from '~/lib/projects/project-statuses';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  WORK_DESIGN_SETTINGS_PROFILES,
  redirectIfProfileNotIn,
} from '../../_lib/server/workspace-route-guard';
import { createProjectStatusesService } from '../../projects/_lib/server/project-statuses.service';
import { ProjectStatusesPanel } from './_components/project-statuses-panel';

export const generateMetadata = async () => ({ title: 'Project statuses' });

interface ProjectStatusesSettingsPageProps {
  params: Promise<{ account: string }>;
}

async function ProjectStatusesSettingsPage({
  params,
}: ProjectStatusesSettingsPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfProfileNotIn(workspace, account, WORK_DESIGN_SETTINGS_PROFILES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'jobs')) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const service = createProjectStatusesService(getSupabaseServerClient());
  let statuses = fallbackProjectStatuses(accountId);
  try {
    statuses = await service.list(accountId);
  } catch (error) {
    const logger = await getLogger();
    logger.error(
      { name: 'project-statuses', error },
      'Failed to load workspace statuses',
    );
    statuses = fallbackProjectStatuses(accountId);
  }

  const canEdit = access.isOwner || access.isAdmin;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-6 md:px-6">
      <ProjectStatusesPanel
        accountId={accountId}
        accountSlug={account}
        initialStatuses={statuses}
        canEdit={canEdit}
      />
    </div>
  );
}

export default withI18n(ProjectStatusesSettingsPage);
