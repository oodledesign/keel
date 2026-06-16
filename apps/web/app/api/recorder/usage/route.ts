import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { loadRecorderUsageSummary } from '~/lib/recorder/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const client = getSupabaseServerClient();
  const summary = await loadRecorderUsageSummary(client, auth.user_id);

  return NextResponse.json({
    tier: summary.tier,
    period: summary.period,
    duration_seconds: summary.durationSeconds,
    limits: {
      max_duration_seconds_per_month:
        summary.limits.maxDurationSecondsPerMonth,
    },
    remaining: {
      duration_seconds: summary.remainingDurationSeconds,
    },
  });
}
