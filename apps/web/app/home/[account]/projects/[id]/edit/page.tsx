import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { JobEditContent } from '../../_components/job-edit-content';
import { createJobsService } from '../../_lib/server/jobs.service';
import { loadJobsPageData } from '../../_lib/server/jobs-page.loader';

interface JobEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  await params;
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.jobs');
  return { title: `Edit job – ${title}` };
};

async function JobEditPage({ params }: JobEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'jobs')) {
    notFound();
  }

  const { accountId, canViewJobs, canEditJobs, canDeleteJobs } = await loadJobsPageData(accountSlug);

  if (!id) notFound();
  if (!canEditJobs) notFound();

  const service = createJobsService(getSupabaseServerClient());
  let job: Awaited<ReturnType<typeof service.getJob>>;
  try {
    job = await service.getJob({ accountId, jobId: id });
  } catch {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`Edit: ${job?.title ?? 'Job'}`}
        description={<AppBreadcrumbs values={{ [id]: job?.title ?? 'Job' }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <JobEditContent
          accountSlug={accountSlug}
          accountId={accountId}
          jobId={id}
          job={job as Record<string, unknown>}
          canViewJobs={canViewJobs}
          canEditJobs={canEditJobs}
          canDeleteJobs={canDeleteJobs}
        />
      </PageBody>
    </>
  );
}

export default withI18n(JobEditPage);
