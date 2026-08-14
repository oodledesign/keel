import { NextResponse } from 'next/server';

import { createBunnyStreamClient } from '@kit/bunny';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  VIDEO_MASTERS_BUCKET,
  ensureEditProject,
  masterStoragePath,
  upsertVideoMaster,
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

/** Prefer mid/low MP4s first — enough for edit + Whisper, less memory on Vercel. */
const RESOLUTION_PREFERENCE = [
  '480p',
  '360p',
  '720p',
  '240p',
  '1080p',
] as const;

function siteReferer() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  return `${fromEnv || 'https://app.ozer.so'}/`;
}

function playUrlCandidates(
  cdnHostname: string,
  bunnyVideoId: string,
  resolutions: string | null,
) {
  const host = cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!host || !bunnyVideoId) return [] as string[];

  const available = new Set(
    (resolutions ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
  );

  const ordered = [
    ...RESOLUTION_PREFERENCE.filter((r) => available.has(r)),
    ...[...available].filter(
      (r) => !(RESOLUTION_PREFERENCE as readonly string[]).includes(r),
    ),
  ];

  if (ordered.length === 0) {
    ordered.push('720p', '480p', '360p');
  }

  return [
    ...ordered.map((res) => `https://${host}/${bunnyVideoId}/play_${res}.mp4`),
    `https://${host}/${bunnyVideoId}/original`,
  ];
}

async function downloadWithHotlinkReferer(url: string) {
  const referer = siteReferer();
  return fetch(url, {
    headers: {
      // Bunny "Block direct URL file access" requires an allowed Referer.
      Referer: referer,
      Origin: referer.replace(/\/$/, ''),
    },
    redirect: 'follow',
  });
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
    .select('id, storage_path')
    .eq('video_id', videoId)
    .maybeSingle();

  const admin = getSupabaseServerAdminClient();
  let masterObjectExists = false;
  if (existing?.storage_path) {
    const folder = String(existing.storage_path).replace(/\/[^/]+$/, '');
    const { data: listed } = await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .list(folder, { limit: 50 });
    masterObjectExists = Boolean(
      listed?.some(
        (obj) =>
          obj.name === 'master.mp4' &&
          Number((obj.metadata as { size?: number } | null)?.size ?? 0) > 0,
      ),
    );
  }

  // DB may say has_master while the storage object was never uploaded / was deleted.
  if ((existing || video.has_master) && masterObjectExists) {
    return NextResponse.json({ ok: true, alreadyHadMaster: true });
  }

  try {
    const apiKey = await resolveAccountBunnyApiKey(access.client, accountId);
    const bunny = createBunnyStreamClient(apiKey);
    const bunnyVideo = await bunny.getVideo(libraryId, bunnyVideoId);
    const cdnHostname = await resolveBunnyCdnHostname(libraryId);
    const candidates = playUrlCandidates(
      cdnHostname,
      bunnyVideoId,
      bunnyVideo.availableResolutions,
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not resolve a playable MP4 from Bunny. Wait until encoding finishes, then try again.',
        },
        { status: 409 },
      );
    }

    let mediaRes: Response | null = null;
    let playUrl: string | null = null;
    let lastStatus = 0;

    for (const url of candidates) {
      const res = await downloadWithHotlinkReferer(url);
      lastStatus = res.status;
      if (res.ok) {
        mediaRes = res;
        playUrl = url;
        break;
      }
    }

    if (!mediaRes || !playUrl) {
      return NextResponse.json(
        {
          error: `Could not download published video (${lastStatus || 'no response'}). Bunny may still be encoding, or direct file access is blocked. You can upload a local master instead.`,
          lastStatus,
          canUploadLocally: true,
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
    console.error('[videos/master/import-from-stream]', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to import master from published video',
        canUploadLocally: true,
      },
      { status: 500 },
    );
  }
}
