import { NextResponse } from 'next/server';

import { processMeetingPostSync } from '~/lib/recorder/meeting-post-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing meeting id' }, { status: 400 });
  }

  try {
    const result = await processMeetingPostSync(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[recorder] meeting post-sync worker failed', id, error);
    return NextResponse.json(
      { error: 'Meeting processing failed' },
      { status: 500 },
    );
  }
}
