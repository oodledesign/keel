import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  FORMS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { isCommercialPropertyProfile } from '../_lib/workspace-profile';
import { FormsList } from './_components/forms-list';
import { loadWorkspaceFormsPage } from './_lib/server/forms.loader';

interface FormsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Forms',
});

async function FormsPage({ params }: FormsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, FORMS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'forms')
  ) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const { forms } = await loadWorkspaceFormsPage(workspace.account.id);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Forms"
        description="Public forms for enquiries, with share links and website embeds."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
        <FormsList
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          forms={forms}
          showListingDestination={isCommercialPropertyProfile(
            workspace.workspaceProfile,
          )}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FormsPage);
