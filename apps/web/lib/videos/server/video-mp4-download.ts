import 'server-only';

import { NextResponse } from 'next/server';

import { resolveBunnyCdnHostname } from './videos-data';

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

export function videoDownloadContentDisposition(title: string) {
  const base =
    title
      .replace(/[^\p{L}\p{N} _.-]+/gu, '')
      .trim()
      .slice(0, 120) || 'video';
  const ascii = base.replace(/[^\x20-\x7e]+/g, '') || 'video';
  return `attachment; filename="${ascii}.mp4"; filename*=UTF-8''${encodeURIComponent(`${base}.mp4`)}`;
}

export function videoFileMatchesPublishedEdit(video: {
  published_revision?: number | null;
  baked_revision?: number | null;
}) {
  const published = Number(video.published_revision ?? 0);
  return published === 0 || Number(video.baked_revision ?? 0) === published;
}

/**
 * Stream the highest available Bunny MP4. The CDN URL stays on the server.
 */
export async function bunnyMp4DownloadResponse(video: {
  title: string;
  bunny_video_id: string;
  bunny_library_id: string;
  published_revision?: number | null;
  baked_revision?: number | null;
}) {
  if (!videoFileMatchesPublishedEdit(video)) {
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
      'Content-Disposition': videoDownloadContentDisposition(
        String(video.title),
      ),
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
