import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isAccountModuleEnabled,
  isRanklyModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export async function loadAccountModuleSettings(
  client: SupabaseClient,
  accountId: string,
): Promise<Record<string, boolean>> {
  const { data, error } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId)
    .eq('enabled', true);

  if (error) {
    console.error('[quick-action] module settings:', error.message);
    return {};
  }

  return Object.fromEntries(
    (data ?? []).map((row) => [row.module_key as string, true]),
  ) as Record<string, boolean>;
}

export async function assertAccountMember(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const ok = await userIsAccountMember(client, userId, accountId);
  if (!ok) {
    throw new Error('You are not a member of that workspace');
  }
}

export async function assertTasksModuleEnabled(
  client: SupabaseClient,
  accountId: string,
): Promise<void> {
  const settings = await loadAccountModuleSettings(client, accountId);
  if (!isAccountModuleEnabled(settings, 'tasks')) {
    throw new Error('Tasks module is disabled for this workspace');
  }
}

export async function assertRanklyModuleEnabled(
  client: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<void> {
  const settings = await loadAccountModuleSettings(client, accountId);
  if (!isRanklyModuleEnabled(settings)) {
    throw new Error('Rankly module is disabled for this workspace');
  }

  const { canUseAddon } = await import('~/lib/billing/entitlements');
  const allowed = await canUseAddon(client, userId, accountId, 'addon_rankly');
  if (!allowed) {
    throw new Error('Rankly add-on required. Subscribe from Billing in this workspace.');
  }
}
