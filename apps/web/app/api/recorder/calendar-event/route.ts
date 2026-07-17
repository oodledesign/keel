import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  authenticateRecorderRequest,
  recorderServiceUnavailable,
} from '~/lib/api-tokens/recorder-auth';
import { getRecorderCalendarEvent } from '~/lib/integrations/google-calendar/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25;

const CALENDAR_HANDLER_TIMEOUT_MS = 20_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('recorder_calendar_timeout')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const admin = getSupabaseServerAdminClient();

  try {
    const result = await withTimeout(
      getRecorderCalendarEvent(admin, { userId: auth.user_id }),
      CALENDAR_HANDLER_TIMEOUT_MS,
    );
    const { data: userData } = await withTimeout(
      admin.auth.admin.getUserById(auth.user_id),
      5_000,
    );

    return NextResponse.json({
      ...result,
      user_email: userData?.user?.email?.trim() || null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not load calendar event';
    const isTimeout =
      message.includes('timeout') || message.includes('Timeout');
    return NextResponse.json(
      { error: message },
      {
        status: isTimeout ? 503 : 502,
        headers: isTimeout ? { 'Retry-After': '30' } : undefined,
      },
    );
  }
}
