import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function logAdminAction(
  admin: SupabaseClient,
  input: {
    actorUserId: string;
    action: string;
    targetAccountId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from('admin_action_log').insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_account_id: input.targetAccountId ?? null,
    metadata: input.metadata ?? {},
  });
}
