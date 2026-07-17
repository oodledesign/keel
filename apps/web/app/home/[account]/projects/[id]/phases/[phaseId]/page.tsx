import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { websitePlanningTabForPhase } from '~/lib/websites/website-design-template';

import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../../_lib/server/workspace-route-guard';
import { createWebsitePlanningService } from '../../../../websites/_lib/server/website-planning.service';
import { PhaseDetailContent } from '../../../_components/phase-detail/phase-detail-content';
import type { PhaseRecord } from '../../../_components/phase-detail/phase-meta-panel';
import type { PhaseNote } from '../../../_components/phase-detail/phase-notes-panel';
import type { JobBoardTask } from '../../../_lib/schema/project-phases.schema';
import { loadJobsPageData } from '../../../_lib/server/jobs-page.loader';
import { createJobsService } from '../../../_lib/server/jobs.service';
import { createProjectPhasesService } from '../../../_lib/server/project-phases.service';

interface JobPhasePageProps {
  params: Promise<{ account: string; id: string; phaseId: string }>;
}

async function JobPhasePage({ params }: JobPhasePageProps) {
  const { account: accountSlug, id: jobId, phaseId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'jobs')) {
    notFound();
  }

  const { accountId, canViewJobs, canEditJobs } =
    await loadJobsPageData(accountSlug);
  if (!canViewJobs) notFound();

  const client = getSupabaseServerClient();
  const jobsService = createJobsService(client);
  const phasesService = createProjectPhasesService(client);

  let job: Awaited<ReturnType<typeof jobsService.getJob>>;
  try {
    job = await jobsService.getJob({ accountId, jobId });
  } catch {
    notFound();
  }

  let detail: Awaited<ReturnType<typeof phasesService.getPhaseDetail>>;
  try {
    detail = await phasesService.getPhaseDetail({ accountId, phaseId });
  } catch {
    notFound();
  }

  const phaseRow = detail.phase as Record<string, unknown>;
  const phaseProjectId =
    (phaseRow.project_id as string | undefined) ??
    (phaseRow.job_id as string | undefined);
  if (phaseProjectId !== jobId) notFound();

  const phase: PhaseRecord = {
    id: phaseRow.id as string,
    name: phaseRow.name as string,
    description: (phaseRow.description as string | null) ?? null,
    status: phaseRow.status as PhaseRecord['status'],
    is_milestone: Boolean(phaseRow.is_milestone),
    colour: (phaseRow.colour as string | null) ?? null,
    start_date: (phaseRow.start_date as string | null) ?? null,
    due_date: (phaseRow.due_date as string | null) ?? null,
    completed_at: (phaseRow.completed_at as string | null) ?? null,
  };

  const pageDocRow = detail.pageDoc as Record<string, unknown>;
  const pageDoc = {
    id: pageDocRow.id as string,
    title: (pageDocRow.title as string) ?? phase.name,
    content: (pageDocRow.content as string | null) ?? '',
  };

  const tasks = detail.tasks as JobBoardTask[];
  const notes = (detail.notes as Record<string, unknown>[]).map(
    (n): PhaseNote => ({
      id: n.id as string,
      title: (n.title as string | null) ?? null,
      content: n.content as string,
      is_pinned: Boolean(n.is_pinned),
      created_at: n.created_at as string,
      updated_at: n.updated_at as string,
    }),
  );

  const jobTitle = (job.title as string) ?? 'Project';

  const planningService = createWebsitePlanningService(client);
  let linkedWebsite: { id: string; name: string } | null = null;

  try {
    linkedWebsite = await planningService.getWebsiteForJob(accountId, jobId);
  } catch {
    linkedWebsite = null;
  }

  const planningTab = websitePlanningTabForPhase(phase.name);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={phase.name}
        description={
          <AppBreadcrumbs
            values={{
              [jobId]: jobTitle,
              [phaseId]: phase.name,
            }}
          />
        }
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6">
        <PhaseDetailContent
          accountSlug={accountSlug}
          accountId={accountId}
          jobId={jobId}
          jobTitle={jobTitle}
          phase={phase}
          pageDoc={pageDoc}
          tasks={tasks}
          notes={notes}
          canEditJobs={canEditJobs}
          linkedWebsite={linkedWebsite}
          planningTab={planningTab}
        />
      </PageBody>
    </>
  );
}

export default withI18n(JobPhasePage);
