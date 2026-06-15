import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr } from '~/lib/rankly/api-response';

export async function requireApiUser() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      response: jsonErr('UNAUTHORIZED', 'Sign in required', 401),
    };
  }

  return { ok: true as const, user, client };
}
