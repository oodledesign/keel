import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

/**
 * Rankly projects are scoped by team account; membership is enforced via RLS.
 * This helper mirrors legacy `userOwnsProject` using account membership.
 */
export async function userCanAccessProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data: project, error } = await supabaseCustomSchema(
    supabase,
    'rankly',
  ).from('projects')
    .select('account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project?.account_id) return false;

  const { data: membership } = await supabase
    .from('accounts_memberships')
    .select('id')
    .eq('account_id', project.account_id as string)
    .eq('user_id', userId)
    .maybeSingle();

  return !!membership;
}
