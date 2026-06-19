import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
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
  const i18n = await createI18nServerInstance();
  return {
    title: `${i18n.t('common:routes.tasks')} — Review`,
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
      <TeamAccountLayoutPageHeader
        title="Task review"
        description="Review AI-suggested tasks from meeting transcripts before they are added to the planner."
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
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
