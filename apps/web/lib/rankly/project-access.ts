import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { userIsAccountMember } from './account-membership';

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
  )
    .from('projects')
    .select('account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project?.account_id) return false;

  return userIsAccountMember(supabase, userId, project.account_id as string);
}
