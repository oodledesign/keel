import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { assertAccountAdmin } from '~/lib/signatures/account-access';
import { denyUnlessSignaturesAddon } from '~/lib/signatures/require-signatures-api-access';
import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';
import { pushSignatureToStaff } from '~/lib/signatures/signatures-provider';

const bodySchema = z.object({
  staffId: z.string().uuid(),
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

    const db = getSignaturesSupabaseClient();
    const { data: staffRow, error: staffErr } = await db
      .from('staff')
      .select('account_id')
      .eq('id', parsed.data.staffId)
      .maybeSingle();

    if (staffErr) {
      return jsonErr('DB_ERROR', staffErr.message, 500);
    }
    if (!staffRow?.account_id) {
      return jsonErr('NOT_FOUND', 'Staff not found', 404);
    }

    const adminErr = await assertAccountAdmin(
      client,
      staffRow.account_id as string,
      user.id,
    );
    if (adminErr) return adminErr;

    const addonDenied = await denyUnlessSignaturesAddon(
      client,
      user.id,
      staffRow.account_id as string,
    );
    if (addonDenied) return addonDenied;

    const result = await pushSignatureToStaff(parsed.data.staffId);
    return jsonOk(result);
  } catch (e) {
    return jsonErr(
      'UNKNOWN',
      e instanceof Error ? e.message : 'Error',
      500,
    );
  }
}
