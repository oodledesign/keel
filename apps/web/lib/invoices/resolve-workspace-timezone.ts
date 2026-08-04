import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveWorkspaceTimezoneForAccount(
  client: SupabaseClient,
  accountId: string,
  userId?: string | null,
): Promise<string> {
  if (userId) {
    const { data } = await client
      .from('workspace_focus_settings')
      .select('timezone')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();
    const tz = (data?.timezone as string | null)?.trim();
    if (tz) return tz;
  }

  const { data: anyRow } = await client
    .from('workspace_focus_settings')
    .select('timezone')
    .eq('account_id', accountId)
    .limit(1)
    .maybeSingle();

  return (anyRow?.timezone as string | null)?.trim() || 'Europe/London';
}
