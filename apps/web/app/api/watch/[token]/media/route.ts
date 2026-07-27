import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { normalizeTimeline } from '~/lib/videos/edit-timeline';
import { createSignedMasterUrl } from '~/lib/videos/server/video-edit.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * Token-gated media for the public timeline player.
 * Never exposes the private bucket — short-lived signed URLs only.
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
      'id, account_id, title, has_master, published_timeline, published_revision, duration_seconds, public_share_enabled',
    )
    .eq('public_share_token', token)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!video?.has_master || !video.published_timeline) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: master } = await admin
    .from('video_masters')
    .select(
      'storage_path, mic_storage_path, system_storage_path, duration_ms',
    )
    .eq('video_id', video.id)
    .maybeSingle();

  if (!master?.storage_path) {
    return NextResponse.json({ error: 'Master missing' }, { status: 404 });
  }

  const expiresIn = 60 * 60;
  const masterUrl = await createSignedMasterUrl(
    String(master.storage_path),
    expiresIn,
  );

  let micUrl: string | null = null;
  let systemUrl: string | null = null;
  if (master.mic_storage_path) {
    try {
      micUrl = await createSignedMasterUrl(
        String(master.mic_storage_path),
        expiresIn,
      );
    } catch {
      micUrl = null;
    }
  }
  if (master.system_storage_path) {
    try {
      systemUrl = await createSignedMasterUrl(
        String(master.system_storage_path),
        expiresIn,
      );
    } catch {
      systemUrl = null;
    }
  }

  const durationMs =
    master.duration_ms ??
    (video.duration_seconds != null
      ? Number(video.duration_seconds) * 1000
      : 0);

  return NextResponse.json({
    ok: true,
    title: video.title,
    masterUrl,
    micUrl,
    systemUrl,
    expiresIn,
    publishedRevision: video.published_revision ?? 0,
    timeline: normalizeTimeline(video.published_timeline, durationMs),
  });
}
