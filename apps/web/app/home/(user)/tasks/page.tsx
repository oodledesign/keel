import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

async function TasksContent({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const params = await searchParams;
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [tasks, includeWorkspaceTasks] = await Promise.all([
    loadTasksForUser(),
    loadPersonalIncludeWorkspaceTasks(client, user.id),
  ]);

  const initialWorkspaceFilter =
    params.workspace?.trim() ||
    (includeWorkspaceTasks ? 'all' : 'personal');

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
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 px-3 pb-8 pt-3 md:px-6 md:pb-12 md:pt-6 lg:max-w-4xl lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="h-8 w-32 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-4 w-48 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="flex items-center justify-between gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton only
            key={i}
            className="h-16 animate-pulse rounded-xl bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
