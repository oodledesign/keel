import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { JobsPageContent } from '~/home/[account]/projects/_components/jobs-page-content';
import { createJobsService } from '~/home/[account]/projects/_lib/server/jobs.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { PERSONAL_PROJECTS_ACCOUNT_SLUG } from '~/lib/projects/project-paths';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const metadata = {
  title: 'Projects',
};

async function PersonalProjectsPage() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const accountId = await getPersonalAccountId(client, user.id);

  if (!accountId) {
    redirect(pathsConfig.app.home);
  }

  const jobsService = createJobsService(client);
  const jobsResult = await jobsService.listJobs({
    accountId,
    tab: 'all',
    page: 1,
    pageSize: 200,
  });
  const jobsPayload = jobsResult as { data?: unknown[] };

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-3 py-3 md:px-4 md:py-4">
      <JobsPageContent
        accountSlug={PERSONAL_PROJECTS_ACCOUNT_SLUG}
        accountId={accountId}
        canViewJobs
        canEditJobs
        isContractorView={false}
        uiVariant="simple"
        personalScope
        initialJobs={(jobsPayload.data ?? []) as never}
        initialCampaigns={[]}
        initialMembers={[]}
      />
    </PageBody>
  );
}

export default withI18n(PersonalProjectsPage);
