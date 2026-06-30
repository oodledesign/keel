import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ACCOUNT_NOTES_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

interface NewNotePageProps {
  params: Promise<{ account: string }>;
}

async function NewNotePage({ params }: NewNotePageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

  redirect(
    `${pathsConfig.app.accountNotes.replace('[account]', accountSlug)}?new=1`,
  );
}

export default NewNotePage;
