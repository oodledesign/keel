import { NextResponse } from 'next/server';

import { z } from 'zod';

import { normalizeVideoSummary } from '~/lib/videos/server/generate-video-summary';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const PutBodySchema = z.object({
  summary: z.string().max(600),
});

export async function PUT(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);

  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = PutBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid summary payload' },
      { status: 400 },
    );
  }

  const summary = normalizeVideoSummary(parsed.data.summary);

  const { error } = await access.client
    .from('videos')
    .update({
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('account_id', access.video!.account_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
