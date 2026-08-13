import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

import { PortalMyTasksList } from './_components/portal-my-tasks-list';

interface PortalMyTasksPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'My tasks' });

export default async function PortalMyTasksPage({
  params,
}: PortalMyTasksPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const tasks = await service.listPortalMyTasks(ctx.clientOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          My tasks
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Action items assigned to you by the team.
        </p>
      </div>

      <PortalMyTasksList
        clientOrgId={ctx.clientOrgId}
        initialTasks={tasks}
      />
    </div>
  );
}
