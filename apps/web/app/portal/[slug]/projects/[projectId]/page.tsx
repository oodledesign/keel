import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatPortalDate } from '../../_components/portal-badges';
import { PortalProjectBoard } from '../../_components/portal-project-board';
import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';
import { createClientPortalService } from '../../_lib/server/client-portal.service';

interface PortalProjectDetailPageProps {
  params: Promise<{ slug: string; projectId: string }>;
}

export const generateMetadata = async () => ({ title: 'Project' });

export default async function PortalProjectDetailPage({
  params,
}: PortalProjectDetailPageProps) {
  const { slug, projectId } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());

  const project = await service.getPortalProject(ctx.clientOrgId, projectId);

  if (!project) {
    notFound();
  }

  const tasks = await service.listPortalProjectTasks(
    ctx.clientOrgId,
    projectId,
  );
  const comments = await service.listPortalTaskComments(
    ctx.clientOrgId,
    tasks.map((task) => task.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          {project.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          {project.status ? `${project.status.replace(/_/g, ' ')} · ` : ''}
          Due {formatPortalDate(project.dueDate)}
        </p>
      </div>

      <PortalProjectBoard
        clientOrgId={ctx.clientOrgId}
        projectId={projectId}
        initialTasks={tasks}
        initialComments={comments}
      />
    </div>
  );
}
