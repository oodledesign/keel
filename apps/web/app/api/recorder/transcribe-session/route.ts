import { NextResponse } from 'next/server';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cloud STT (Soniox) is wired in the repo but not used in production.
 * Meeting audio is transcribed on-device by the Ozer Assistant for Mac.
 */
export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  return NextResponse.json(
    {
      error:
        'Cloud transcription is not enabled. Use the Ozer Assistant for Mac for on-device transcription.',
      provider: 'disabled',
    },
    { status: 503 },
  );
}
