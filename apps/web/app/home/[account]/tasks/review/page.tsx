import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { MeetingTaskReviewClient } from './_components/meeting-task-review-client';
import { loadMeetingTaskReviewPageData } from './_lib/server/meeting-review.loader';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  return {
    title: 'Meeting task review',
  };
};

async function MeetingTaskReviewPage({ params }: PageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'tasks')) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadMeetingTaskReviewPageData(accountSlug);

  return (
    <>
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6 md:py-8">
        <MeetingTaskReviewClient
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          initialItems={data.items}
          members={data.members}
          automationSettings={data.automationSettings}
        />
      </PageBody>
    </>
  );
}

export default withI18n(MeetingTaskReviewPage);
