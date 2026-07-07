import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Activity tables are not yet in generated Database types.
 * Use an untyped client until `supabase gen types` includes them.
 */
export function getActivitySupabaseClient(): SupabaseClient {
  return getSupabaseServerClient() as SupabaseClient;
}

export function getActivitySupabaseAdminClient(): SupabaseClient {
  return getSupabaseServerAdminClient() as SupabaseClient;
}
