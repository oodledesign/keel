import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { createJobsService } from '../_lib/server/jobs.service';
import { loadJobsPageData } from '../_lib/server/jobs-page.loader';
import { JobDetailContent } from '../_components/job-detail-content';

interface JobDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  const { id } = await params;
  if (id === 'new') return { title: 'Create job' };
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.jobs');
  return { title: `${title} – ${id.slice(0, 8)}` };
};

async function JobDetailPage({ params }: JobDetailPageProps) {
  const { account: accountSlug, id } = await params;
  const { accountId, canViewJobs, canEditJobs, isContractorView } =
    await loadJobsPageData(accountSlug);

  if (id === 'new' || !id) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const service = createJobsService(client);
  let job: Awaited<ReturnType<typeof service.getJob>>;
  try {
    job = await service.getJob({ accountId, jobId: id });
  } catch {
    notFound();
  }

  let jobClient: { id: string; display_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null = null;
  if (job?.client_id) {
    const { data } = await client.from('clients').select('id, display_name, email, phone, company_name').eq('id', job.client_id).eq('account_id', accountId).maybeSingle();
    jobClient = data;
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={job?.title ?? 'Job'}
        description={<AppBreadcrumbs values={{ [id]: job?.title ?? 'Job' }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <JobDetailContent
          accountSlug={accountSlug}
          accountId={accountId}
          jobId={id}
          job={job as Record<string, unknown>}
          client={jobClient}
          canViewJobs={canViewJobs}
          canEditJobs={canEditJobs}
          isContractorView={isContractorView}
        />
      </PageBody>
    </>
  );
}

export default withI18n(JobDetailPage);
