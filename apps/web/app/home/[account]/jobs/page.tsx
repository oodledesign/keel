import { use } from 'react';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadJobsPageData } from './_lib/server/jobs-page.loader';
import { JobsPageContent } from './_components/jobs-page-content';

interface JobsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.jobs');
  return { title };
};

async function JobsPage({ params }: JobsPageProps) {
  const accountSlug = (await params).account;
  const {
    accountId,
    accountSlug: slug,
    canViewJobs,
    canEditJobs,
    isContractorView,
  } =
    await loadJobsPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.jobs" />}
        description="Manage jobs and assignments"
        account={slug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <JobsPageContent
          accountSlug={slug}
          accountId={accountId}
          canViewJobs={canViewJobs}
          canEditJobs={canEditJobs}
          isContractorView={isContractorView}
        />
      </PageBody>
    </>
  );
}

export default withI18n(JobsPage);
