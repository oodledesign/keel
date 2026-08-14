import { NextResponse } from 'next/server';

import { generateVideoSummary } from '~/lib/videos/server/generate-video-summary';
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
  if (!video.account_id) {
    return NextResponse.json({ error: 'Video has no account' }, { status: 500 });
  }

  try {
    const summary = await generateVideoSummary({
      client: access.client,
      videoId,
      accountId: video.account_id as string,
      force: true,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate summary';
    const isUserError =
      message.includes('Transcript') ||
      message.includes('empty') ||
      message.includes('AI returned');
    return NextResponse.json(
      { error: isUserError ? message : 'Failed to generate summary' },
      { status: isUserError ? 422 : 500 },
    );
  }
}
