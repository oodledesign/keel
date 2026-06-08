import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isCommunityNavModuleEnabled,
  isFamilyNavModuleEnabled,
  isPropertyNavModuleEnabled,
  isWorkNavModuleEnabled,
} from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ACCOUNT_NOTES_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { NoteEditor } from '../_components/note-editor';
import { loadNoteDetailData } from '../_lib/server/notes-page.loader';

interface NoteDetailPageProps {
  params: Promise<{ account: string; noteId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Edit note',
});

async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const { account: accountSlug, noteId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

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

  const data = await loadNoteDetailData(accountSlug, noteId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title={data.note.title || 'Untitled note'}
        description="Edit note"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-white lg:px-8">
        <NoteEditor
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          note={data.note}
        />
      </PageBody>
    </>
  );
}

export default withI18n(NoteDetailPage);
