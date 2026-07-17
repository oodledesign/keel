import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  listDictationHistory,
  saveDictationHistory,
} from '~/lib/recorder/dictation-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SaveBodySchema = z.object({
  text: z.string().min(1),
  account_id: z.string().uuid().optional().nullable(),
  created_at: z.string().datetime().optional(),
  paste_mode: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

  try {
    const items = await listDictationHistory({
      userId: auth.user_id,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load dictation history';
    return NextResponse.json({ error: message }, { status: 500 });
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

  const parsed = SaveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const result = await saveDictationHistory({
      userId: auth.user_id,
      text: parsed.data.text,
      accountId: parsed.data.account_id,
      pasteMode: parsed.data.paste_mode,
      createdAt: parsed.data.created_at,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save dictation';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
