import { NextResponse } from 'next/server';

import { authenticateRecorderRequest, recorderServiceUnavailable } from '~/lib/api-tokens/recorder-auth';
import { loadRecorderToday } from '~/lib/recorder/load-recorder-today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const payload = await loadRecorderToday(auth.user_id);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[recorder/today]', error);
    return recorderServiceUnavailable(
      error instanceof Error ? error.message : undefined,
    );
  }
}
