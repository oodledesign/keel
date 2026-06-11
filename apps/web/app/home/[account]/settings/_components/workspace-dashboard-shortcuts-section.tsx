import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadWorkspaceShortcutsSettings } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { WorkspaceDashboardShortcutsSettingsForm } from './workspace-dashboard-shortcuts-settings-form';

type Props = {
  accountId: string;
  accountSlug: string;
};

export async function WorkspaceDashboardShortcutsSection({
  accountId,
  accountSlug,
}: Props) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const data = await loadWorkspaceShortcutsSettings(client, user.id, accountId);

  return (
    <WorkspaceDashboardShortcutsSettingsForm
      accountId={accountId}
      accountSlug={accountSlug}
      initialShortcuts={data.shortcuts}
    />
  );
}
