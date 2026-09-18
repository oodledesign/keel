import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../../_lib/role-access';
import { isAccountModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { ChildProfileClient } from '../../_components/child-profile-client';
import { loadFamilyMemoriesPage } from '../../_lib/server/family-memories.loader';

interface FamilyChildProfilePageProps {
  params: Promise<{ account: string; personId: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Child` };
};

async function FamilyChildProfilePage({ params }: FamilyChildProfilePageProps) {
  const { account: slug, personId } = await params;
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

  const data = await loadFamilyMemoriesPage({
    accountSlug: slug,
    childId: personId,
  });
  const child = data.people.find((person) => person.id === personId) ?? null;

  if (!child) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title={child.display_name}
        description={child.ageLabel ?? 'Memories for this child, newest first.'}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-0 text-[var(--workspace-shell-text)] lg:px-0">
        <ChildProfileClient
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          child={child}
          people={data.people}
          memories={data.memories}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FamilyChildProfilePage);
