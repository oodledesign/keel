/**
 * Mac Assistant Today. Response includes task lists plus optional `finance`
 * (dashboard income/outgoings months) and `triage` (email/task counts).
 * See ./README.md. Null finance/triage means the Mac UI should deep-link.
 */
import { NextResponse } from 'next/server';

import {
  authenticateRecorderRequest,
  recorderServiceUnavailable,
} from '~/lib/api-tokens/recorder-auth';
import { loadRecorderToday } from '~/lib/recorder/load-recorder-today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('account_id')?.trim() || null;
    const payload = await loadRecorderToday(auth.user_id, {
      preferredAccountId: accountId ?? auth.account_id,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[recorder/today]', error);
    return recorderServiceUnavailable(
      error instanceof Error ? error.message : undefined,
    );
  }
}
