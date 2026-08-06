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
  const sp = await searchParams;
  // Explicit intent (e.g. "Create your own workspace" from the client
  // portal) bypasses the smart-redirect below — someone who deliberately
  // asked to see this form should see it, even if they'd otherwise be
  // auto-routed elsewhere (portal-only contacts, accepted guests, etc.).
  const forceShow = sp.start === '1';
  const needsSetup = forceShow || (await userRequiresWorkspaceSetup(user.id));

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
