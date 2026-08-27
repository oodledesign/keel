import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Whether a user has the platform super-admin role (via auth app_metadata). */
export async function isUserSuperAdminById(
  adminClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return false;
  }

  return data.user.app_metadata?.role === 'super-admin';
}
