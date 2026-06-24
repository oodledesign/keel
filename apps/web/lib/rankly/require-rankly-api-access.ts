import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { denyUnlessAddonAccess } from '~/lib/billing/require-addon-api-access';
import { jsonErr } from '~/lib/rankly/api-response';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export async function denyUnlessRanklyAddon(
  client: SupabaseClient,
  userId: string,
  accountId: string,
) {
  return denyUnlessAddonAccess(client, userId, accountId, 'addon_rankly');
}

export async function denyUnlessRanklyAddonForProject(
  client: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project?.account_id) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return denyUnlessRanklyAddon(client, userId, project.account_id as string);
}
