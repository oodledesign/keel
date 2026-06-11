import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { parseSetupIntent } from '~/lib/billing/pricing-marketing';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { userRequiresWorkspaceSetup } from '~/lib/server/workspace-setup-guard';

import { WorkspaceSetupForm } from './_components/workspace-setup-form';

export const metadata = {
  title: 'Set up your workspaces — Keel',
};

export default async function WorkspaceSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUserInServerComponent();
  const needsSetup = await userRequiresWorkspaceSetup(user.id);

  if (!needsSetup) {
    redirect(pathsConfig.app.home);
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
