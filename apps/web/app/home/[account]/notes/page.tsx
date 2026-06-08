import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isCommunityNavModuleEnabled,
  isFamilyNavModuleEnabled,
  isPropertyNavModuleEnabled,
  isWorkNavModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  ACCOUNT_NOTES_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { NotesPageContent } from './_components/notes-page-content';
import { loadNotesPageData } from './_lib/server/notes-page.loader';

interface NotesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Notes',
});

async function NotesPage({ params }: NotesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const notesEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'notes')
      : spaceType === 'family'
        ? isFamilyNavModuleEnabled(workspace.moduleSettings, 'notes')
        : spaceType === 'community'
          ? isCommunityNavModuleEnabled(workspace.moduleSettings, 'notes')
          : isWorkNavModuleEnabled(workspace.moduleSettings, 'notes');

  if (!access.canViewDashboard || !notesEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadNotesPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title="Notes"
        description={
          spaceType === 'family'
            ? 'Shared notes for your family.'
            : spaceType === 'community'
              ? 'Shared notes for your homegroup.'
              : spaceType === 'property'
                ? 'Workspace notes linked to your properties.'
                : 'Account notes linked to projects and clients.'
        }
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-white lg:px-8">
        <NotesPageContent
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          notes={data.notes}
          tableAvailable={data.tableAvailable}
          variant={data.variant}
          linkOptions={data.linkOptions}
        />
      </PageBody>
    </>
  );
}

export default withI18n(NotesPage);
