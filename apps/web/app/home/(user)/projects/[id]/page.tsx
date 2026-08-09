import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { JobDetailContent } from '~/home/[account]/projects/_components/job-detail-content';
import { createJobsService } from '~/home/[account]/projects/_lib/server/jobs.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { PERSONAL_PROJECTS_ACCOUNT_SLUG } from '~/lib/projects/project-paths';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

interface PersonalProjectDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('projects')
    .select('name, title')
    .eq('id', id)
    .maybeSingle();

  const title =
    (
      data as { title?: string | null; name?: string | null } | null
    )?.title?.trim() ||
    (data as { name?: string | null } | null)?.name?.trim() ||
    'Project';

  return { title };
};

async function PersonalProjectDetailPage({
  params,
}: PersonalProjectDetailPageProps) {
  const { id } = await params;
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const accountId = await getPersonalAccountId(client, user.id);

  if (!accountId) {
    redirect(pathsConfig.app.home);
  }

  const service = createJobsService(client);
  let job: Awaited<ReturnType<typeof service.getJob>>;
  try {
    job = await service.getJob({ accountId, jobId: id });
  } catch {
    notFound();
  }

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-2 py-2 md:px-3 md:py-3">
      <JobDetailContent
        accountSlug={PERSONAL_PROJECTS_ACCOUNT_SLUG}
        accountId={accountId}
        jobId={id}
        job={job as Record<string, unknown>}
        client={null}
        canViewJobs
        canEditJobs
        isContractorView={false}
        workspaceNotes={[]}
        workspaceDocs={[]}
        notesTableAvailable
        docsTableAvailable
        linkOptions={[]}
        defaultLink={{ type: 'job' as const, id }}
      />
    </PageBody>
  );
}

export default withI18n(PersonalProjectDetailPage);
