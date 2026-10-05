'use client';

import { useMemo } from 'react';

import { projectPhaseHref } from '~/lib/projects/project-paths';

import type { JobBoardResult } from '../../_lib/schema/project-phases.schema';
import { ContentCalendarPanel } from './content/content-calendar-panel';
import { RoadmapPanel } from './content/roadmap-panel';
import { useProjectContent } from './content/use-project-content';

export function JobProjectRoadmap({
  accountId,
  accountSlug,
  jobId,
  board,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  board: JobBoardResult;
  canEdit: boolean;
}) {
  const content = useProjectContent({ accountId, jobId });
  const tasks = useMemo(
    () => Object.values(board.tasksByPhase).flat(),
    [board.tasksByPhase],
  );

  return (
    <RoadmapPanel
      content={content}
      phases={board.phases}
      tasks={tasks}
      canEdit={canEdit}
      phaseHref={(phaseId) => projectPhaseHref(accountSlug, jobId, phaseId)}
    />
  );
}

export function JobProjectContent({
  accountId,
  jobId,
  canEdit,
}: {
  accountId: string;
  jobId: string;
  canEdit: boolean;
}) {
  const content = useProjectContent({ accountId, jobId });
  return <ContentCalendarPanel content={content} canEdit={canEdit} />;
}
