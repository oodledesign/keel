import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadJobsPageData } from './_lib/server/jobs-page.loader';
import { JobsPageContent } from './_components/jobs-page-content';

interface JobsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string }>;
}) => {
  const workspace = await loadTeamWorkspace((await params).account);
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  return {
    title: spaceType === 'property' ? 'Maintenance' : 'Projects',
  };
};

async function JobsPage({ params }: JobsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

  const jobsEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'maintenance')
      : isWorkModuleEnabled(workspace.moduleSettings, 'jobs');

  if (!jobsEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const {
    accountId,
    accountSlug: slug,
    canViewJobs,
    canEditJobs,
    isContractorView,
  } = await loadJobsPageData(accountSlug);

  const isProperty = spaceType === 'property';

  return (
    <>
      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-3 py-3 md:px-4 md:py-4">
        <JobsPageContent
          accountSlug={slug}
          accountId={accountId}
          canViewJobs={canViewJobs}
          canEditJobs={canEditJobs}
          isContractorView={isContractorView}
          uiVariant={isProperty ? 'maintenance' : 'projects'}
        />
      </PageBody>
    </>
  );
}

export default withI18n(JobsPage);
