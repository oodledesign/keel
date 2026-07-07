import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { SonioxApiError } from '~/lib/integrations/soniox/create-temporary-api-key';
import { isSonioxConfigured } from '~/lib/integrations/soniox/env';
import {
  SonioxTranscribeSessionError,
  createSonioxTranscribeSession,
} from '~/lib/integrations/soniox/transcribe-session';
import { loadRecorderUsageSummary } from '~/lib/recorder/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!isSonioxConfigured()) {
    return NextResponse.json(
      {
        error:
          'Soniox transcription is not configured on this server. Set SONIOX_API_KEY.',
      },
      { status: 503 },
    );
  }

  const client = getSupabaseServerAdminClient();
  const summary = await loadRecorderUsageSummary(client, auth.user_id);

  try {
    const session = await createSonioxTranscribeSession(
      auth.user_id,
      summary,
    );
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof SonioxTranscribeSessionError) {
      return NextResponse.json(
        {
          error: error.message,
          usage: {
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
          },
        },
        { status: error.status },
      );
    }

    if (error instanceof SonioxApiError) {
      return NextResponse.json(
        { error: error.message, provider: 'soniox' },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    throw error;
  }
}
