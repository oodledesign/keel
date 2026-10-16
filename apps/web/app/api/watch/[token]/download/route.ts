import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { resolveEffectivePlayerConfig } from '~/lib/videos/server/player-config-data';
import { bunnyMp4DownloadResponse } from '~/lib/videos/server/video-mp4-download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * Public download for a shared video. Only when Sharing → Allow download is on.
 * The file is streamed through here so the CDN URL is never exposed.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = getSupabaseServerAdminClient();
  const { data: video, error } = await admin
    .from('videos')
    .select(
      'id, account_id, title, status, bunny_video_id, bunny_library_id, published_revision, baked_revision',
    )
    .eq('public_share_token', token)
    .eq('public_share_enabled', true)
    .eq('status', 'ready')
    .maybeSingle();

  if (error) {
    console.error('[videos] public download', error);
    return NextResponse.json({ error: 'Not available' }, { status: 500 });
  }
  if (!video) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const resolved = await resolveEffectivePlayerConfig(
    admin,
    String(video.account_id),
    String(video.id),
  );
  if (!resolved.config.allow_download) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return bunnyMp4DownloadResponse({
    title: String(video.title),
    bunny_video_id: String(video.bunny_video_id),
    bunny_library_id: String(video.bunny_library_id),
    published_revision: video.published_revision as number | null,
    baked_revision: video.baked_revision as number | null,
  });
}
