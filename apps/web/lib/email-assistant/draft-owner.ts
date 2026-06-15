import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type DraftOwnerContext = {
  email: string;
  displayName: string | null;
};

export async function resolveDraftOwnerContext(
  userId: string,
): Promise<DraftOwnerContext | null> {
  const admin = getSupabaseServerAdminClient();

  const [{ data: connection }, { data: account }, { data: authUser }] =
    await Promise.all([
      admin
        .from('google_connections')
        .select('google_email')
        .eq('user_id', userId)
        .maybeSingle(),
      admin.from('accounts').select('name, email').eq('id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);

  const ownerEmail =
    (connection as { google_email?: string | null } | null)?.google_email?.trim() ||
    authUser.data.user?.email?.trim() ||
    (account as { email?: string | null } | null)?.email?.trim() ||
    '';

  if (!ownerEmail) {
    return null;
  }

  const meta = authUser.data.user?.user_metadata as
    | Record<string, unknown>
    | undefined;

  let displayName = (account as { name?: string | null } | null)?.name?.trim() || null;

  if (!displayName && meta) {
    for (const key of ['full_name', 'name'] as const) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) {
        displayName = value.trim();
        break;
      }
    }
  }

  return { email: ownerEmail, displayName };
}
