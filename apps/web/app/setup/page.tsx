import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { parseSetupIntent } from '~/lib/billing/pricing-marketing';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { userRequiresWorkspaceSetup } from '~/lib/server/workspace-setup-guard';

import { WorkspaceSetupForm } from './_components/workspace-setup-form';

export const metadata = {
  title: 'Set up your workspaces — Ozer',
};

export default async function WorkspaceSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUserInServerComponent();
  const needsSetup = await userRequiresWorkspaceSetup(user.id);

  if (!needsSetup) {
    const admin = getSupabaseServerAdminClient();
    const { data: guest } = await admin
      .from('project_guests')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const guestProjectId = (guest as { project_id?: string } | null)
      ?.project_id;

    redirect(
      guestProjectId
        ? pathsConfig.app.personalGuestProject.replace(
            '[projectId]',
            guestProjectId,
          )
        : pathsConfig.app.home,
    );
  }

  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') params.set(key, value);
  }

  const intent = parseSetupIntent(params);

  return (
    <div className="min-h-screen bg-[var(--workspace-shell-canvas)]">
      <WorkspaceSetupForm intent={intent} />
    </div>
  );
}
