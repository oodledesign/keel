import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import { jsonErr } from '~/lib/rankly/api-response';

import { requireApiUser } from './require-api-user';

export async function requireEmailAssistantApiUser() {
  const auth = await requireApiUser();

  if (!auth.ok) {
    return auth;
  }

  const allowed = await canUseEmailAssistant(auth.client, auth.user.id);

  if (!allowed) {
    return {
      ok: false as const,
      response: jsonErr(
        'FORBIDDEN',
        'Email Assistant add-on required. Subscribe from Billing in your personal account.',
        403,
      ),
    };
  }

  return auth;
}
