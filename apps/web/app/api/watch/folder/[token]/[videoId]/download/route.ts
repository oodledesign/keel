import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { findVideoInSharedFolder } from '~/lib/videos/server/public-folder.loader';
import { resolveBunnyCdnHostname } from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string; videoId: string }>;
};

/** Best first; Bunny only serves renditions up to the source resolution. */
const MP4_RENDITIONS = [
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
  '360p',
  '240p',
] as const;

function contentDisposition(title: string) {
  const base =
    title
      .replace(/[^\p{L}\p{N} _.-]+/gu, '')
      .trim()
      .slice(0, 120) || 'video';
  const ascii = base.replace(/[^\x20-\x7e]+/g, '') || 'video';
  return `attachment; filename="${ascii}.mp4"; filename*=UTF-8''${encodeURIComponent(`${base}.mp4`)}`;
}

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
      'title, bunny_video_id, bunny_library_id, published_revision, baked_revision',
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

  const published = Number(video.published_revision ?? 0);
  if (published > 0 && Number(video.baked_revision ?? 0) !== published) {
    return NextResponse.json(
      { error: 'This video is still processing its latest edit.' },
      { status: 409 },
    );
  }

  const host = await resolveBunnyCdnHostname(String(video.bunny_library_id));
  if (!host) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  for (const rendition of MP4_RENDITIONS) {
    const upstream = await fetch(
      `https://${host}/${video.bunny_video_id}/play_${rendition}.mp4`,
      { cache: 'no-store' },
    );
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      continue;
    }

    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Content-Disposition': contentDisposition(String(video.title)),
      'Cache-Control': 'private, no-store',
    });
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);

    return new Response(upstream.body, { headers });
  }

  return NextResponse.json(
    { error: 'No downloadable file is available for this video.' },
    { status: 404 },
  );
}
