import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { assertAccountAdmin } from '~/lib/signatures/account-access';
import { pushAllSignatures } from '~/lib/signatures/graph';

const bodySchema = z.object({
  accountId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const adminErr = await assertAccountAdmin(
      client,
      parsed.data.accountId,
      user.id,
    );
    if (adminErr) return adminErr;

    const summary = await pushAllSignatures(parsed.data.accountId, user.id);
    return jsonOk(summary);
  } catch (e) {
    return jsonErr(
      'UNKNOWN',
      e instanceof Error ? e.message : 'Error',
      500,
    );
  }
}
