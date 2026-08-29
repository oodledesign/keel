import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkNavModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { MeetingsPageContent } from './_components/meetings-page-content';
import { loadMeetingsPageData } from './_lib/server/meetings-page.loader';

interface MeetingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async ({ params }: MeetingsPageProps) => {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  return {
    title:
      workspace.workspaceProfile === 'building_surveyor'
        ? 'Transcripts'
        : 'Meetings',
  };
};

async function MeetingsPage({ params }: MeetingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work', 'building-surveyor']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewClients ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'clients')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadMeetingsPageData(accountSlug);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <MeetingsPageContent
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        transcripts={data.transcripts}
        upcomingMeetings={data.upcomingMeetings}
        clients={data.clients}
        canEdit={data.canEdit}
      />
    </PageBody>
  );
}

export default MeetingsPage;
