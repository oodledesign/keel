import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Throws unless the account is a building-surveyor workspace.
 * Used by pipeline/lead/quote server actions that sit outside the surveys service.
 */
export async function assertBuildingSurveyorAccount(
  accountId: string,
  message = 'This action is only available in a building-surveyor workspace',
) {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();

  if (
    (data as { space_type?: string } | null)?.space_type !== 'building-surveyor'
  ) {
    throw new Error(message);
  }
}
