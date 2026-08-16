import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type DashboardPresetId,
  isDashboardPresetId,
} from '~/config/dashboard-presets.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export async function loadWorkspaceDashboardPreset(
  accountId: string,
): Promise<DashboardPresetId | null> {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const { data } = await client
    .from('workspace_dashboard_shortcuts')
    .select('dashboard_preset')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .maybeSingle();

  const value = data?.dashboard_preset ?? null;
  if (!value || !isDashboardPresetId(value)) return null;
  return value;
}
