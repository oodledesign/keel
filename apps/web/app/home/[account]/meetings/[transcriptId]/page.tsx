import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { loadTaskAssignmentOptionsForWorkspace } from '~/home/(user)/_lib/actions/task-actions';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { MeetingTranscriptDetailClient } from '../_components/meeting-transcript-detail-client';
import { loadMeetingTranscriptPageData } from '../_lib/server/meetings-page.loader';

interface MeetingDetailPageProps {
  params: Promise<{ account: string; transcriptId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: MeetingDetailPageProps) {
  const { transcriptId, account } = await params;
  const data = await loadMeetingTranscriptPageData(account, transcriptId);
  return {
    title: data.transcript?.title ?? 'Meeting',
  };
}

async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const { account: accountSlug, transcriptId } = await params;
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

  const data = await loadMeetingTranscriptPageData(accountSlug, transcriptId);

  if (!data.transcript) {
    notFound();
  }

  const assignmentOptions = await loadTaskAssignmentOptionsForWorkspace(
    data.accountId,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={data.transcript.title}
        description="Transcript, AI summary, and task extraction"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <MeetingTranscriptDetailClient
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          transcript={data.transcript}
          summary={data.summary}
          clients={data.clients}
          contacts={data.contacts}
          members={data.members}
          currentUserId={data.currentUserId}
          canEdit={data.canEdit}
          assignmentOptions={assignmentOptions}
        />
      </PageBody>
    </>
  );
}

export default MeetingDetailPage;
