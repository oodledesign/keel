import { Suspense } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { loadPersonalIncludeWorkspaceTasks } from '~/lib/personal-preferences/load-unified-tasks-preference';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadTasksForUser } from '../_lib/server/tasks.loader';
import { TasksPageClient } from './_components/tasks-page-client';

export const metadata = { title: 'Tasks' };

type PageProps = {
  searchParams: Promise<{ workspace?: string }>;
};

export default function TasksPage(props: PageProps) {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<TasksSkeleton />}>
        <TasksContent searchParams={props.searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function TasksContent({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [tasks, includeWorkspaceTasks] = await Promise.all([
    loadTasksForUser(),
    loadPersonalIncludeWorkspaceTasks(client, user.id),
  ]);

  const initialWorkspaceFilter =
    params.workspace?.trim() || (includeWorkspaceTasks ? 'all' : 'personal');

  return (
    <TasksPageClient
      initialTasks={tasks}
      includeWorkspaceTasks={includeWorkspaceTasks}
      initialWorkspaceFilter={initialWorkspaceFilter}
    />
  );
}

function TasksSkeleton() {
  return (
    <div className={cn(workspacePageMainClassName, 'min-h-0')}>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="h-8 w-32 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
          <div className="h-4 w-48 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="flex items-center justify-between gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton only
            key={i}
            className="h-16 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]"
          />
        ))}
      </div>
    </div>
  );
}
