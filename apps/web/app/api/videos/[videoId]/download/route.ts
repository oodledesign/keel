import { NextResponse } from 'next/server';

import { bunnyMp4DownloadResponse } from '~/lib/videos/server/video-mp4-download';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

/** Owner download from the video settings page. */
export async function GET(_request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);

  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (
    access.error === 'NOT_FOUND' ||
    access.error === 'FORBIDDEN' ||
    !access.video
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const video = access.video;
  if (video.status !== 'ready') {
    return NextResponse.json(
      { error: 'This video is still processing.' },
      { status: 409 },
    );
  }

  return bunnyMp4DownloadResponse({
    title: String(video.title),
    bunny_video_id: String(video.bunny_video_id),
    bunny_library_id: String(video.bunny_library_id),
    published_revision: video.published_revision as number | null,
    baked_revision: video.baked_revision as number | null,
  });
}
