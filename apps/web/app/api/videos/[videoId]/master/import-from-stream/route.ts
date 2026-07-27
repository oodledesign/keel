import { NextResponse } from 'next/server';

import { createBunnyStreamClient } from '@kit/bunny';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  ensureEditProject,
  masterStoragePath,
  upsertVideoMaster,
  VIDEO_MASTERS_BUCKET,
} from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';
import {
  resolveAccountBunnyApiKey,
  resolveBunnyCdnHostname,
} from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

function pickPlayUrl(cdnHostname: string, bunnyVideoId: string, resolutions: string | null) {
  const host = cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!host || !bunnyVideoId) return null;

  const list = (resolutions ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  const preferred = ['1080p', '720p', '480p', '360p', '240p'];
  const pick =
    preferred.find((p) => list.includes(p)) ?? list[list.length - 1] ?? '720p';

  return `https://${host}/${bunnyVideoId}/play_${pick}.mp4`;
}

/**
 * Backfill an editable master from the already-published Bunny Stream file.
 * Used when the Mac recorder uploaded Stream-only (no master sidecar yet).
 */
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
  const accountId = video.account_id as string;
  const bunnyVideoId = String(video.bunny_video_id ?? '');
  const libraryId = String(video.bunny_library_id ?? '');

  if (!bunnyVideoId || !libraryId) {
    return NextResponse.json(
      { error: 'Video is missing Bunny Stream ids' },
      { status: 400 },
    );
  }

  const { data: existing } = await access.client
    .from('video_masters')
    .select('id')
    .eq('video_id', videoId)
    .maybeSingle();

  if (existing || video.has_master) {
    return NextResponse.json({ ok: true, alreadyHadMaster: true });
  }

  try {
    const apiKey = await resolveAccountBunnyApiKey(access.client, accountId);
    const bunny = createBunnyStreamClient(apiKey);
    const bunnyVideo = await bunny.getVideo(libraryId, bunnyVideoId);
    const cdnHostname = await resolveBunnyCdnHostname(libraryId);
    const playUrl = pickPlayUrl(
      cdnHostname,
      bunnyVideoId,
      bunnyVideo.availableResolutions,
    );

    if (!playUrl) {
      return NextResponse.json(
        {
          error:
            'Could not resolve a playable MP4 from Bunny. Wait until encoding finishes, then try again.',
        },
        { status: 409 },
      );
    }

    const mediaRes = await fetch(playUrl);
    if (!mediaRes.ok) {
      return NextResponse.json(
        {
          error: `Could not download published video (${mediaRes.status}). Try again once status is Ready.`,
        },
        { status: 502 },
      );
    }

    const bytes = Buffer.from(await mediaRes.arrayBuffer());
    if (bytes.byteLength < 1000) {
      return NextResponse.json(
        { error: 'Downloaded master was empty' },
        { status: 502 },
      );
    }

    const path = masterStoragePath(accountId, videoId);
    const admin = getSupabaseServerAdminClient();
    const { error: uploadError } = await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .upload(path, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const durationMs =
      bunnyVideo.length > 0
        ? Math.round(bunnyVideo.length * 1000)
        : video.duration_seconds != null
          ? Number(video.duration_seconds) * 1000
          : null;

    await upsertVideoMaster({
      client: access.client,
      videoId,
      accountId,
      storagePath: path,
      contentType: 'video/mp4',
      byteSize: bytes.byteLength,
      width: bunnyVideo.width,
      height: bunnyVideo.height,
      durationMs,
    });

    await ensureEditProject({
      client: access.client,
      videoId,
      accountId,
      durationMs: durationMs ?? 0,
      userId: access.user?.id,
    });

    return NextResponse.json({
      ok: true,
      byteSize: bytes.byteLength,
      durationMs,
      sourceUrl: playUrl,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to import master from published video',
      },
      { status: 500 },
    );
  }
}
