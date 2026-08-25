import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { GuestProjectBoard } from '~/lib/projects/components/guest-project-board';
import {
  linkPendingProjectGuestsForUser,
  listAcceptedGuestsForUser,
} from '~/lib/projects/project-guests.service';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

async function PersonalGuestProjectPage(props: PageProps) {
  const { projectId } = await props.params;
  const user = await requireUserInServerComponent();
  await linkPendingProjectGuestsForUser();

  const guests = await listAcceptedGuestsForUser(user.id);
  const access = guests.find((g) => g.projectId === projectId);

  if (!access) {
    redirect(pathsConfig.app.home);
  }

  const admin = getSupabaseServerAdminClient();
  // Live projects columns may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (admin as any)
    .from('projects')
    .select('id, name, title, status, account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const { data: tasks } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, user_id, notes, sort_order, created_at',
    )
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  const projectName =
    ((project as { title?: string | null }).title ?? '').trim() ||
    ((project as { name?: string | null }).name ?? '').trim() ||
    'Project';

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Guest access
              {access.accountName ? ` · ${access.accountName}` : ''}
            </p>
            <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              {projectName}
            </h1>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              You can work on this project&apos;s tasks only.
            </p>
          </div>
          <Link
            href={pathsConfig.app.home}
            className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            Back to home
          </Link>
        </div>

        <GuestProjectBoard
          projectId={projectId}
          accountId={access.accountId}
          permissions={access.permissions}
          initialTasks={(tasks ?? []) as Array<Record<string, unknown>>}
        />
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalGuestProjectPage);
