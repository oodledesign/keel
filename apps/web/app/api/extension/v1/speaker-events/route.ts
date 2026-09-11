import { NextResponse } from 'next/server';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  IngestSpeakerEventsSchema,
  ListSpeakerEventsQuerySchema,
  ingestExtensionSpeakerEvents,
  listExtensionSpeakerEvents,
} from '~/lib/extension/speaker-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = ListSpeakerEventsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  try {
    const result = await listExtensionSpeakerEvents({
      userId: auth.user_id,
      defaultAccountId: auth.account_id,
      sessionId: parsed.data.session_id,
      accountId: parsed.data.account_id,
      since: parsed.data.since,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load speaker events';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

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

  const parsed = IngestSpeakerEventsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const result = await ingestExtensionSpeakerEvents({
      userId: auth.user_id,
      defaultAccountId: auth.account_id,
      body: parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to store speaker events';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
