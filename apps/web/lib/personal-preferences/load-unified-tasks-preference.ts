import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadPersonalIncludeWorkspaceTasks(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await client
    .from('user_settings')
    .select('personal_include_workspace_tasks')
    .eq('user_id', userId)
    .maybeSingle();

  const row = data as { personal_include_workspace_tasks?: boolean | null } | null;

  if (row?.personal_include_workspace_tasks === false) {
    return false;
  }

  return true;
}
