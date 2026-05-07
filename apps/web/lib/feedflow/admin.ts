import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

/** Service-role client scoped to `feedflow` schema (PostgREST). */
export function createFeedflowAdminClient() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'feedflow');
}
