import 'server-only';

import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createSignedMasterUrl } from './video-edit.service';
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

function downloadBaseName(title: string) {
  return (
    title
      .replace(/[^\p{L}\p{N} _.-]+/gu, '')
      .trim()
      .slice(0, 120) || 'video'
  );
}

/**
 * Redirect to the file instead of streaming it through the app. Large videos
 * die on the serverless body limit, which looks like a click that does nothing.
 * Prefer the stored master (what the timeline player uses). Fall back to a
 * Bunny MP4 rendition for videos that were only uploaded to the stream.
 */
export async function videoFileDownloadResponse(video: {
  id: string;
  title: string;
  bunny_video_id: string;
  bunny_library_id: string;
}) {
  const admin = getSupabaseServerAdminClient();
  const { data: master } = await admin
    .from('video_masters')
    .select('storage_path')
    .eq('video_id', video.id)
    .maybeSingle();

  const storagePath = master?.storage_path ? String(master.storage_path) : '';
  if (storagePath) {
    const ext = storagePath.split('.').pop()?.toLowerCase();
    const suffix = ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'mp4';
    const url = await createSignedMasterUrl(
      storagePath,
      60 * 10,
      `${downloadBaseName(video.title)}.${suffix}`,
    );
    return NextResponse.redirect(url);
  }

  const host = await resolveBunnyCdnHostname(String(video.bunny_library_id));
  if (!host) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  for (const rendition of MP4_RENDITIONS) {
    const fileUrl = `https://${host}/${video.bunny_video_id}/play_${rendition}.mp4`;
    const head = await fetch(fileUrl, { method: 'HEAD', cache: 'no-store' });
    if (!head.ok) continue;
    return NextResponse.redirect(fileUrl);
  }

  return NextResponse.json(
    { error: 'No downloadable file is available for this video.' },
    { status: 404 },
  );
}
