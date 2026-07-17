import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { loadWorkspaceMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { loadWorkspaceFocusSettingsMap } from '~/lib/workspace-focus/load-workspace-focus-settings';
import { serializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

import { loadWorkNavCounts } from './work-nav-counts.loader';

export type TeamWorkspaceShellAdornments = {
  navCounts: WorkNavCounts;
  mobileNavShortcuts: Awaited<
    ReturnType<typeof loadWorkspaceMobileNavShortcuts>
  >;
  focusSettingsByAccountId: ReturnType<typeof serializeWorkspaceFocusMap>;
};

export async function loadTeamWorkspaceShellAdornments(params: {
  client: SupabaseClient;
  userId: string;
  accountId: string;
  accountSlug: string;
  moduleSettings: Record<string, boolean>;
  focusAccountIds: string[];
}): Promise<TeamWorkspaceShellAdornments> {
  const [navCounts, mobileNavShortcuts, focusSettings] = await Promise.all([
    loadWorkNavCounts(
      params.client,
      params.accountId,
      params.moduleSettings,
    ).catch((error) => {
      console.error('[team-workspace] loadWorkNavCounts:', error);
      return {} as WorkNavCounts;
    }),
    loadWorkspaceMobileNavShortcuts(
      params.client,
      params.userId,
      params.accountId,
      params.accountSlug,
    ),
    loadWorkspaceFocusSettingsMap(
      params.client,
      params.userId,
      params.focusAccountIds,
    ),
  ]);

  return {
    navCounts,
    mobileNavShortcuts,
    focusSettingsByAccountId: serializeWorkspaceFocusMap(focusSettings),
  };
}
