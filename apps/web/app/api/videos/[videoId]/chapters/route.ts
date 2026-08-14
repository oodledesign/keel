import { NextResponse } from 'next/server';

import { z } from 'zod';

import { normalizeVideoChapters } from '~/lib/videos/server/generate-video-chapters';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  startMs: z.number().int().nonnegative(),
});

const PutBodySchema = z.object({
  chapters: z.array(ChapterSchema).max(40),
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
      { error: 'Invalid chapters payload' },
      { status: 400 },
    );
  }

  const chapters = normalizeVideoChapters(parsed.data.chapters);

  const { error } = await access.client
    .from('videos')
    .update({
      chapters,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('account_id', access.video.account_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chapters });
}
