import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  resolveWorkspaceProfile,
  type WorkspaceProfile,
} from './workspace-profile';

export type TeamAccountWorkspace = Awaited<
  ReturnType<typeof loadTeamWorkspace>
>;

/**
 * Load the account workspace data.
 * We place this function into a separate file so it can be reused in multiple places across the server components.
 *
 * This function is used in the layout component for the account workspace.
 * It is cached so that the data is only fetched once per request.
 *
 * @param accountSlug
 */
export const loadTeamWorkspace = cache(workspaceLoader);

async function workspaceLoader(accountSlug: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const api = createTeamAccountsApi(client);

  const [workspace, user] = await Promise.all([
    api.getAccountWorkspace(accountSlug),
    requireUserInServerComponent(),
  ]);

  if (workspace.error) {
    const message =
      workspace.error instanceof Error
        ? workspace.error.message
        : String(workspace.error);
    console.error('[team-workspace] getAccountWorkspace:', message);
    redirect(pathsConfig.app.home);
  }

  // we cannot find any record for the selected account
  // so we redirect the user to the home page
  if (!workspace.data?.account) {
    redirect(pathsConfig.app.home);
  }

  const accountId = (workspace.data.account as { id: string }).id;
  const { data: moduleSettingsRows, error: moduleSettingsError } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId)
    .eq('enabled', true);

  if (moduleSettingsError) {
    console.error(
      '[team-workspace] account_module_settings:',
      moduleSettingsError.message,
    );
  }

  const moduleSettings = Object.fromEntries(
    (moduleSettingsRows ?? []).map((row) => [row.module_key, true]),
  ) as Record<string, boolean>;

  let businessType: string | null = null;
  const { data: businessRow } = await client
    .from('businesses')
    .select('type')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessRow) {
    businessType = (businessRow as { type?: string | null }).type ?? null;
  }

  const accountRecord = workspace.data.account as {
    id: string;
    slug: string;
    space_type?: string | null;
  };

  const workspaceProfile = resolveWorkspaceProfile({
    space_type: accountRecord.space_type,
    business_type: businessType,
  });

  const data = workspace.data;

  return {
    ...data,
    account: accountRecord,
    moduleSettings,
    workspaceProfile,
    businessType,
    user,
  };
}

export type { WorkspaceProfile };
