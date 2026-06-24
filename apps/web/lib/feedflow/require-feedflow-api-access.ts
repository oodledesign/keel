import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { denyUnlessAddonAccess } from '~/lib/billing/require-addon-api-access';

export async function denyUnlessFeedflowAddon(
  client: SupabaseClient,
  userId: string,
  accountId: string,
) {
  return denyUnlessAddonAccess(client, userId, accountId, 'addon_feedflow');
}
