import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';
import { createPersonalVisionService } from '~/lib/personal-vision/personal-vision.service';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PersonalVisionSettingsForm } from './personal-vision-settings-form';

export async function PersonalVisionSettingsSection() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const service = createPersonalVisionService(client);
  const [row, memberships] = await Promise.all([
    service.loadForUser(user.id),
    loadUserTeamMemberships(user.id, client),
  ]);

  return (
    <PersonalVisionSettingsForm
      initialContent={row.content}
      initialFinanceAccountIds={row.financeAccountIds}
      initialDashboardEnabled={row.dashboardEnabled}
      initialMorningPromptEnabled={row.morningPromptEnabled}
      workspaces={memberships.map((m) => ({
        id: m.id,
        name: m.name?.trim() || m.slug || 'Workspace',
        spaceType: m.space_type,
      }))}
    />
  );
}
