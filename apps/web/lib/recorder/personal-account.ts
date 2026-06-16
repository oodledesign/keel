import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPersonalAccountId(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('accounts')
    .select('id')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.id as string | undefined) ?? null;
}
