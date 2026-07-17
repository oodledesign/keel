'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { workspacePageContentClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

import { AskBrainLink } from '../../../brain/_components/ask-brain-link';
import type { JobBoardTask } from '../../_lib/schema/project-phases.schema';
import { ProjectAiGenerateDialog } from '../job-project/project-ai-generate-dialog';
import { PhaseMetaPanel, type PhaseRecord } from './phase-meta-panel';
import { type PhaseNote, PhaseNotesPanel } from './phase-notes-panel';
import { PhasePageEditor } from './phase-page-editor';
import { PhasePlanningLinks } from './phase-planning-links';
import { PhaseTasksPanel } from './phase-tasks-panel';

export function PhaseDetailContent({
  accountSlug,
  accountId,
  jobId,
  jobTitle,
  phase: initialPhase,
  pageDoc,
  tasks,
  notes,
  canEditJobs,
  linkedWebsite,
  planningTab,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  jobTitle: string;
  phase: PhaseRecord;
  pageDoc: {
    id: string;
    title: string;
    content: string | null;
  };
  tasks: JobBoardTask[];
  notes: PhaseNote[];
  canEditJobs: boolean;
  linkedWebsite?: { id: string; name: string } | null;
  planningTab?: WebsitePlanningTab | null;
}) {
  const [phase, setPhase] = useState(initialPhase);
  const [pageContent, setPageContent] = useState(pageDoc.content ?? '');
  const [aiOpen, setAiOpen] = useState(false);

  const jobPath = pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId);

  return (
    <div className={cn('w-full space-y-6', workspacePageContentClassName)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={jobPath}
          className="inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {jobTitle}
        </Link>
        <AskBrainLink
          accountSlug={accountSlug}
          label="Ask about this phase"
          className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
          params={{
            jobId,
            jobTitle,
            q: `What is the status and plan for the "${phase.name}" phase?`,
          }}
        />
      </div>

      <PhaseMetaPanel
        accountId={accountId}
        accountSlug={accountSlug}
        jobId={jobId}
        phase={phase}
        canEdit={canEditJobs}
        onPhaseChange={setPhase}
      />

      {linkedWebsite ? (
        <PhasePlanningLinks
          accountSlug={accountSlug}
          websiteId={linkedWebsite.id}
          websiteName={linkedWebsite.name}
          planningTab={planningTab ?? null}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <PhasePageEditor
          accountId={accountId}
          accountSlug={accountSlug}
          jobId={jobId}
          phaseId={phase.id}
          docId={pageDoc.id}
          initialTitle={pageDoc.title}
          initialContent={pageContent}
          canEdit={canEditJobs}
          onOpenAi={() => setAiOpen(true)}
        />

        <div className="space-y-6">
          <PhaseTasksPanel
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={jobId}
            phaseId={phase.id}
            initialTasks={tasks}
            canEdit={canEditJobs}
          />
          <PhaseNotesPanel
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={jobId}
            phaseId={phase.id}
            initialNotes={notes}
            canEdit={canEditJobs}
          />
        </div>
      </div>

      {canEditJobs && (
        <ProjectAiGenerateDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          accountId={accountId}
          accountSlug={accountSlug}
          jobId={jobId}
          phaseId={phase.id}
          phaseName={phase.name}
          defaultMode="phase_page"
          allowedModes={['phase_page', 'brief', 'phase_plan']}
          onPhasePageGenerated={setPageContent}
        />
      )}
    </div>
  );
}
