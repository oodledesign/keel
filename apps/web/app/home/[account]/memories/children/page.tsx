import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isAccountModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { ChildrenIndexClient } from '../_components/children-index-client';
import { loadFamilyMemoriesPage } from '../_lib/server/family-memories.loader';

interface FamilyChildrenPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Children` };
};

async function FamilyChildrenPage({ params }: FamilyChildrenPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, ['family']);
  const accountAccess = workspace.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(accountAccess);

  if (
    !access.canViewDashboard ||
    !isAccountModuleEnabled(workspace.moduleSettings, 'memories')
  ) {
    redirect(getDefaultAccountPath(slug, accountAccess));
  }

  const data = await loadFamilyMemoriesPage({ accountSlug: slug });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Children"
        description="Each child is a Person. Memories attach to them."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-0 text-[var(--workspace-shell-text)] lg:px-0">
        <ChildrenIndexClient data={data} />
      </PageBody>
    </>
  );
}

export default withI18n(FamilyChildrenPage);
