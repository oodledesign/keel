import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';

interface CommunityNotesRedirectProps {
  params: Promise<{ account: string }>;
}

async function CommunityNotesRedirectPage({
  params,
}: CommunityNotesRedirectProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['community']);

  redirect(
    pathsConfig.app.accountNotes.replace('[account]', accountSlug),
  );
}

export default CommunityNotesRedirectPage;
