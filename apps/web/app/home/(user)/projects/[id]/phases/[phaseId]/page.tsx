import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { PhaseDetailContent } from '~/home/[account]/projects/_components/phase-detail/phase-detail-content';
import type { PhaseRecord } from '~/home/[account]/projects/_components/phase-detail/phase-meta-panel';
import type { PhaseNote } from '~/home/[account]/projects/_components/phase-detail/phase-notes-panel';
import type { JobBoardTask } from '~/home/[account]/projects/_lib/schema/project-phases.schema';
import { createJobsService } from '~/home/[account]/projects/_lib/server/jobs.service';
import { createProjectPhasesService } from '~/home/[account]/projects/_lib/server/project-phases.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { PERSONAL_PROJECTS_ACCOUNT_SLUG } from '~/lib/projects/project-paths';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

interface PersonalProjectPhasePageProps {
  params: Promise<{ id: string; phaseId: string }>;
}

async function PersonalProjectPhasePage({
  params,
}: PersonalProjectPhasePageProps) {
  const { id: jobId, phaseId } = await params;
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const accountId = await getPersonalAccountId(client, user.id);

  if (!accountId) {
    redirect(pathsConfig.app.home);
  }

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

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6">
      <PhaseDetailContent
        accountSlug={PERSONAL_PROJECTS_ACCOUNT_SLUG}
        accountId={accountId}
        jobId={jobId}
        jobTitle={jobTitle}
        phase={phase}
        pageDoc={pageDoc}
        tasks={tasks}
        notes={notes}
        canEditJobs
        linkedWebsite={null}
        planningTab={null}
      />
    </PageBody>
  );
}

export default withI18n(PersonalProjectPhasePage);
