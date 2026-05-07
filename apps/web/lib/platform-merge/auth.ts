import 'server-only';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function requireMergeAdmin() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401 };
  }

  const canAccess = await isSuperAdmin(client);

  if (!canAccess) {
    return { ok: false as const, status: 403 };
  }

  return { ok: true as const };
}
