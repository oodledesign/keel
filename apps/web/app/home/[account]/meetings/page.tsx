import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { isWorkNavModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { MeetingsPageContent } from './_components/meetings-page-content';
import { loadMeetingsPageData } from './_lib/server/meetings-page.loader';

interface MeetingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Meetings',
});

async function MeetingsPage({ params }: MeetingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

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
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Meetings"
        description="Meeting transcripts across your clients — extract tasks and feed proposals."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <MeetingsPageContent
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          transcripts={data.transcripts}
          clients={data.clients}
          canEdit={data.canEdit}
        />
      </PageBody>
    </>
  );
}

export default MeetingsPage;
