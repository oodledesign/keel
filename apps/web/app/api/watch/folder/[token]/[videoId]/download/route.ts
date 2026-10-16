import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { findVideoInSharedFolder } from '~/lib/videos/server/public-folder.loader';
import { videoFileDownloadResponse } from '~/lib/videos/server/video-mp4-download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string; videoId: string }>;
};

/**
 * Download for a video inside a shared folder. Only works when the owner
 * switched on "Allow downloads" for that folder; the file is streamed through
 * here so it downloads (rather than plays) and the CDN URL is never exposed.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { token, videoId } = await context.params;
  if (!token?.trim() || !videoId?.trim()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const inFolder = await findVideoInSharedFolder(token, videoId);
  if (!inFolder?.allowDownload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = getSupabaseServerAdminClient();
  const { data: video, error } = await admin
    .from('videos')
    .select(
      'id, title, bunny_video_id, bunny_library_id',
    )
    .eq('id', inFolder.id)
    .eq('status', 'ready')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!video) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return videoFileDownloadResponse({
    id: String(video.id),
    title: String(video.title),
    bunny_video_id: String(video.bunny_video_id),
    bunny_library_id: String(video.bunny_library_id),
  });
}
