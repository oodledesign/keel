// Env: CRON_SECRET
import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { submitPendingBatches } from '~/lib/ai/batch';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const supabase = getSupabaseServerAdminClient();
  const processed = await submitPendingBatches(supabase);

  return NextResponse.json({ success: true, processed });
}
