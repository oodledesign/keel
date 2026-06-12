import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PersonalDashboardShortcutsSettingsForm } from './personal-dashboard-shortcuts-settings-form';
import { loadPersonalShortcutsSettings } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export async function PersonalDashboardShortcutsSection() {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const data = await loadPersonalShortcutsSettings(client, user.id);

  return (
    <PersonalDashboardShortcutsSettingsForm
      initialShortcuts={data.shortcuts}
      initialMobileNavShortcuts={data.mobileNavShortcuts}
      initialDefaultLanding={data.defaultLanding}
      workspaceOptions={data.workspaceOptions}
    />
  );
}
