import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import { loadWorkspaceMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { loadWorkspaceFocusSettingsMap } from '~/lib/workspace-focus/load-workspace-focus-settings';
import { serializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

import { loadCommercialPipelineBoardName } from '../../pipeline/_lib/server/pipeline-stage-settings.loader';
import { loadWorkNavCounts } from './work-nav-counts.loader';

export type TeamWorkspaceShellAdornments = {
  navCounts: WorkNavCounts;
  mobileNavShortcuts: Awaited<
    ReturnType<typeof loadWorkspaceMobileNavShortcuts>
  >;
  focusSettingsByAccountId: ReturnType<typeof serializeWorkspaceFocusMap>;
  emailAssistantAvailable: boolean;
  pipelineBoardName?: string;
};

export async function loadTeamWorkspaceShellAdornments(params: {
  client: SupabaseClient;
  userId: string;
  accountId: string;
  accountSlug: string;
  moduleSettings: Record<string, boolean>;
  focusAccountIds: string[];
  loadPipelineBoardName?: boolean;
}): Promise<TeamWorkspaceShellAdornments> {
  const [
    navCounts,
    mobileNavShortcuts,
    focusSettings,
    emailAssistantAvailable,
    pipelineBoardName,
  ] = await Promise.all([
    loadWorkNavCounts(params.client, params.accountId, params.moduleSettings, {
      userId: params.userId,
      // Count even if entitlement is still resolving; badge only renders when Emails is shown.
      emailAssistantAvailable: true,
    }).catch((error) => {
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
    canUseEmailAssistant(params.client, params.userId).catch((error) => {
      console.error('[team-workspace] canUseEmailAssistant:', error);
      return false;
    }),
    params.loadPipelineBoardName
      ? loadCommercialPipelineBoardName(params.accountId).catch(
          (error: unknown) => {
            console.error(
              '[team-workspace] loadCommercialPipelineBoardName:',
              error,
            );
            return DEFAULT_COMMERCIAL_WIP_BOARD_NAME;
          },
        )
      : Promise.resolve(undefined),
  ]);

  return {
    navCounts,
    mobileNavShortcuts,
    focusSettingsByAccountId: serializeWorkspaceFocusMap(focusSettings),
    emailAssistantAvailable,
    pipelineBoardName,
  };
}
