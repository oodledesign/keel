import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PageBody } from '@kit/ui/page';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { DELIVERY_PROJECT_TYPE } from '~/lib/projects/project-types';

import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { loadContextWorkspaceContent } from '../../_lib/workspace-content/context-loader';
import { loadCampaignDetailPageData } from '../_lib/campaign/server/campaign-page.loader';
import { CampaignTableClient } from '../_components/campaign/campaign-table-client';
import { createJobsService } from '../_lib/server/jobs.service';
import { loadJobsPageData } from '../_lib/server/jobs-page.loader';
import { JobDetailContent } from '../_components/job-detail-content';

interface ProjectDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({ params }: ProjectDetailPageProps) => {
  const { account, id } = await params;
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('projects')
    .select('name, title, project_type')
    .eq('id', id)
    .maybeSingle();

  const title =
    (data as { title?: string | null; name?: string | null } | null)?.title?.trim() ||
    (data as { name?: string | null } | null)?.name?.trim() ||
    'Project';

  return { title };
};

async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'jobs')) {
    notFound();
  }

  const { accountId, canViewJobs, canEditJobs, isContractorView } =
    await loadJobsPageData(accountSlug);

  const client = getSupabaseServerClient();
  const { data: projectRow } = await client
    .from('projects')
    .select('id, project_type')
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!projectRow) {
    notFound();
  }

  const projectType = (projectRow as { project_type?: string | null }).project_type;

  if (projectType !== DELIVERY_PROJECT_TYPE) {
    try {
      const data = await loadCampaignDetailPageData(accountSlug, id);
      const listPath = pathsConfig.app.accountProjects.replace('[account]', accountSlug);

      return (
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6">
          <a
            href={listPath}
            className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            ← All projects
          </a>
          <CampaignTableClient
            accountId={data.accountId}
            accountSlug={data.accountSlug}
            project={data.project}
            linkOptions={data.linkOptions}
            canEdit={data.canEdit}
          />
        </PageBody>
      );
    } catch {
      if (projectType === 'campaign') {
        notFound();
      }
    }
  }

  const service = createJobsService(client);
  let job: Awaited<ReturnType<typeof service.getJob>>;
  try {
    job = await service.getJob({ accountId, jobId: id });
  } catch {
    notFound();
  }

  let jobClient: {
    id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  } | null = null;

  if (job?.client_id) {
    const { data } = await client
      .from('clients')
      .select('id, display_name, email, phone, company_name')
      .eq('id', job.client_id)
      .eq('account_id', accountId)
      .maybeSingle();
    jobClient = data;
  }

  const workspaceContent = await loadContextWorkspaceContent({
    accountId,
    spaceType: (workspace.account as { space_type?: string }).space_type,
    businessType: workspace.businessType,
    scope: { jobId: id },
  });

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-3 py-3 md:px-4 md:py-4">
      <JobDetailContent
        accountSlug={accountSlug}
        accountId={accountId}
        jobId={id}
        job={job as Record<string, unknown>}
        client={jobClient}
        canViewJobs={canViewJobs}
        canEditJobs={canEditJobs}
        isContractorView={isContractorView}
        workspaceNotes={workspaceContent.notes}
        workspaceDocs={workspaceContent.docs}
        notesTableAvailable={workspaceContent.notesTableAvailable}
        docsTableAvailable={workspaceContent.docsTableAvailable}
        linkOptions={workspaceContent.linkOptions}
        defaultLink={workspaceContent.defaultLink}
      />
    </PageBody>
  );
}

export default withI18n(ProjectDetailPage);
