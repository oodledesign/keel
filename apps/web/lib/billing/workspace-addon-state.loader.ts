import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  canAccessPaidWorkspace,
  hasEntitlement,
  hasActiveWorkspaceSubscription,
} from './entitlements';
import type { KeelAddonKey } from './keel-plan-catalog';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

export type WorkspaceAddonState = {
  workspacePaid: boolean;
  addons: Record<KeelAddonKey, boolean>;
};

export async function loadWorkspaceAddonState(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  profile: WorkspaceProfile,
): Promise<WorkspaceAddonState> {
  const workspacePaid = await canAccessPaidWorkspace(
    client,
    userId,
    accountId,
    profile,
  );

  const addonKeys: KeelAddonKey[] = [
    'addon_signatures',
    'addon_rankly',
    'addon_feedflow',
    'addon_videos',
  ];

  const addons = {} as Record<KeelAddonKey, boolean>;

  await Promise.all(
    addonKeys.map(async (key) => {
      addons[key] = await hasEntitlement(client, accountId, key);
    }),
  );

  return { workspacePaid, addons };
}

export async function workspaceHasBaseSubscription(
  client: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  return hasActiveWorkspaceSubscription(client, accountId);
}
