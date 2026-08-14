import { NextResponse } from 'next/server';

import { generateVideoChapters } from '~/lib/videos/server/generate-video-chapters';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);

  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const video = access.video!;

  try {
    const chapters = await generateVideoChapters({
      client: access.client,
      videoId,
      accountId: video.account_id as string,
      force: true,
    });

    return NextResponse.json({ ok: true, chapters });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate chapters';
    const status =
      message.includes('Transcript') || message.includes('empty') ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
