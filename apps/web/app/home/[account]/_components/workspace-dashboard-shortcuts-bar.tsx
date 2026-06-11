import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DashboardShortcutsBar } from '~/components/dashboard-shortcuts/dashboard-shortcuts-bar';
import pathsConfig from '~/config/paths.config';
import { loadWorkspaceDashboardShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

type Props = {
  accountId: string;
  accountSlug: string;
};

export async function WorkspaceDashboardShortcutsBar({
  accountId,
  accountSlug,
}: Props) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const shortcuts = await loadWorkspaceDashboardShortcuts(
    client,
    user.id,
    accountId,
    accountSlug,
  );

  return (
    <DashboardShortcutsBar
      shortcuts={shortcuts}
      settingsHref={pathsConfig.app.accountSettings.replace(
        '[account]',
        accountSlug,
      )}
      className="mb-4 pt-4 md:px-6 lg:px-8"
    />
  );
}
