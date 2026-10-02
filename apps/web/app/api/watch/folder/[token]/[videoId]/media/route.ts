import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { findVideoInSharedFolder } from '~/lib/videos/server/public-folder.loader';
import {
  PUBLIC_VIDEO_MEDIA_SELECT,
  type PublicMediaVideo,
  buildPublicVideoMediaResponse,
} from '~/lib/videos/server/public-video-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string; videoId: string }>;
};

/**
 * Folder-gated media for the public timeline player: the video is reachable
 * only because it sits inside a shared folder (or one of its subfolders).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { token, videoId } = await context.params;
  if (!token?.trim() || !videoId?.trim()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const inFolder = await findVideoInSharedFolder(token, videoId);
  if (!inFolder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = getSupabaseServerAdminClient();
  const { data: video, error } = await admin
    .from('videos')
    .select(PUBLIC_VIDEO_MEDIA_SELECT)
    .eq('id', inFolder.id)
    .eq('status', 'ready')
    .eq('status', 'ready')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return buildPublicVideoMediaResponse(admin, video as PublicMediaVideo | null);
}
