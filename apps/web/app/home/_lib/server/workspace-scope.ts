import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type WorkspaceAccountRow = {
  id: string;
  name: string | null;
  slug: string | null;
  space_type: string | null;
  is_personal_account: boolean | null;
  picture_url?: string | null;
};

/**
 * Non-personal accounts the user belongs to (all space types).
 */
export async function loadUserWorkspaceAccounts(
  client: SupabaseClient,
  userId: string,
): Promise<WorkspaceAccountRow[]> {
  const { data, error } = await client
    .from('accounts_memberships')
    .select(
      'account:accounts!inner(id, name, slug, space_type, is_personal_account, picture_url)',
    )
    .eq('user_id', userId);

  if (error) {
    console.error('[workspace-scope] loadUserWorkspaceAccounts:', error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    account: WorkspaceAccountRow | WorkspaceAccountRow[] | null;
  }>;

  const out: WorkspaceAccountRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const acc = Array.isArray(row.account) ? row.account[0] : row.account;
    if (!acc?.id || acc.is_personal_account) continue;
    if (seen.has(acc.id)) continue;
    seen.add(acc.id);
    out.push(acc);
  }

  return out;
}

export async function loadTeamAccountIdsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const workspaces = await loadUserWorkspaceAccounts(client, userId);
  return workspaces.map((w) => w.id);
}

/**
 * Business IDs linked to a workspace: projects.business_id plus businesses.account_id.
 */
export async function loadBusinessIdsForTeamAccount(
  client: SupabaseClient,
  accountId: string,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: projRows, error: projErr } = await client
    .from('projects')
    .select('business_id')
    .eq('account_id', accountId);

  if (!projErr) {
    for (const row of projRows ?? []) {
      const bid = (row as { business_id?: string | null }).business_id;
      if (bid) ids.add(bid);
    }
  }

  const { data: bizRows, error: bizErr } = await client
    .from('businesses')
    .select('id')
    .eq('account_id', accountId);

  if (!bizErr) {
    for (const row of bizRows ?? []) {
      const id = (row as { id: string }).id;
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

/**
 * Session DB for contractors (RLS narrows clients/projects); service-role DB for owner/admin/staff
 * after permission checks — matches clients list reads so assignment pickers show the same rows.
 */
export async function getDbForWorkspaceTaskAssignmentOptions(
  userClient: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<SupabaseClient> {
  const api = createTeamAccountsApi(userClient);
  const hasClientsAccess =
    (await api.hasPermission({
      userId,
      accountId,
      permission: 'clients.view',
    })) ||
    (await api.hasPermission({
      userId,
      accountId,
      permission: 'clients.edit',
    }));

  const { data: membership, error } = await userClient
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  const role = membership?.account_role as string | undefined;
  const membershipFallback =
    role === 'owner' ||
    role === 'admin' ||
    role === 'staff' ||
    role === 'contractor';

  if (!hasClientsAccess && !membershipFallback) {
    throw new Error('Permission denied');
  }

  if (role === 'contractor') {
    return userClient;
  }

  return getSupabaseServerAdminClient() as unknown as SupabaseClient;
}
