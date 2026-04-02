import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { isAccountModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';

interface CommunityNotesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Notes` };
};

async function CommunityNotesPage({ params }: CommunityNotesPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, ['community']);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isAccountModuleEnabled(workspace.moduleSettings, 'notes')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Notes"
        description="Shared notes for your community space."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <p className="text-muted-foreground max-w-xl text-sm">
          Community notes are coming soon.
        </p>
      </PageBody>
    </>
  );
}

export default withI18n(CommunityNotesPage);
