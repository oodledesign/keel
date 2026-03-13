import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadJobsPageData } from '../jobs/_lib/server/jobs-page.loader';
import { OrgSchedulePageContent } from './_components/org-schedule-page-content';

interface OrgSchedulePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.jobs');
  return { title: `${title} – Schedule` };
};

async function OrgSchedulePage({ params }: OrgSchedulePageProps) {
  const { account: accountSlug } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSchedule) {
    return redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const { accountId, canViewJobs } = await loadJobsPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.jobs" />}
        description="Team schedule"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <OrgSchedulePageContent
          accountId={accountId}
          accountSlug={accountSlug}
          canViewJobs={canViewJobs}
        />
      </PageBody>
    </>
  );
}

export default withI18n(OrgSchedulePage);

