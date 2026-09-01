import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type NativeClient,
  type NativeClientRow,
  mapNativeClient,
  workspaceShowsNativeClients,
} from './clients-shared';
import type { NativeWorkspace } from './workspace-shared';

export type { NativeClient } from './clients-shared';
export {
  NATIVE_CLIENT_WORKSPACE_PROFILES,
  mapNativeClient,
  workspaceShowsNativeClients,
} from './clients-shared';

const CLIENT_LIST_LIMIT = 300;

const CLIENT_SELECT =
  'id, display_name, company_name, email, first_name, last_name, client_type';

/**
 * Clients for the selected workspace. Personal / family return `[]` (not 403)
 * so a stale phone tab never errors the user into an empty business list.
 */
export async function listNativeClients(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeClient[]> {
  if (!workspaceShowsNativeClients(workspace.profile)) {
    return [];
  }

  let query = client
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('account_id', workspace.id)
    .order('display_name', { ascending: true, nullsFirst: false })
    .limit(CLIENT_LIST_LIMIT);

  query = query.is('archived_at', null);

  const { data, error } = await query;

  if (error) {
    if (/archived_at/i.test(error.message ?? '')) {
      const legacy = await client
        .from('clients')
        .select(CLIENT_SELECT)
        .eq('account_id', workspace.id)
        .order('display_name', { ascending: true, nullsFirst: false })
        .limit(CLIENT_LIST_LIMIT);

      if (legacy.error) {
        throw new Error(legacy.error.message);
      }

      return ((legacy.data ?? []) as NativeClientRow[]).map(mapNativeClient);
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as NativeClientRow[]).map(mapNativeClient);
}
