import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkNavModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { DocsPageContent } from './_components/docs-page-content';
import { loadDocsPageData } from './_lib/server/docs-page.loader';

interface DocsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Docs',
});

async function DocsPage({ params }: DocsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  const docsEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'docs')
      : isWorkNavModuleEnabled(workspace.moduleSettings, 'docs');

  if (!access.canViewDashboard || !docsEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadDocsPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title="Docs"
        description="Written documents and uploaded files."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-white lg:px-8">
        <DocsPageContent
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          docs={data.docs}
          docTypes={data.docTypes}
          tableAvailable={data.tableAvailable}
          linkOptions={data.linkOptions}
          variant={data.variant}
        />
      </PageBody>
    </>
  );
}

export default withI18n(DocsPage);
