import { NextResponse } from 'next/server';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  ExtensionCaptureSchema,
  createExtensionCapture,
} from '~/lib/extension/capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ExtensionCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const result = await createExtensionCapture({
      userId: auth.user_id,
      body: parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to capture to Ozer';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
