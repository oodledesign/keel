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

/**
 * Prefer low/mid MP4s — enough for edit + Whisper, and more likely to fit
 * under Supabase's global storage file-size limit (often 50MB if unset).
 */
const RESOLUTION_PREFERENCE = [
  '240p',
  '360p',
  '480p',
  '720p',
  '1080p',
] as const;

/** Soft cap for server-side import. Override with VIDEO_MASTER_IMPORT_MAX_BYTES. */
const DEFAULT_MAX_IMPORT_BYTES = 45 * 1024 * 1024;

function maxImportBytes() {
  const raw = process.env.VIDEO_MASTER_IMPORT_MAX_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_IMPORT_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_IMPORT_BYTES;
}

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
    ordered.push('360p', '480p', '240p', '720p');
  }

  // Never fall back to /original here — originals are often hundreds of MB
  // and trip Supabase "object exceeded the maximum allowed size".
  return ordered.map(
    (res) => `https://${host}/${bunnyVideoId}/play_${res}.mp4`,
  );
}

function hotlinkHeaders() {
  const referer = siteReferer();
  return {
    Referer: referer,
    Origin: referer.replace(/\/$/, ''),
  };
}

async function downloadWithHotlinkReferer(url: string) {
  return fetch(url, {
    headers: hotlinkHeaders(),
    redirect: 'follow',
  });
}

async function probeContentLength(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      headers: hotlinkHeaders(),
      redirect: 'follow',
    });
    if (!head.ok) return null;
    const raw = head.headers.get('content-length');
    if (!raw) return null;
    const size = Number(raw);
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  }
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isStorageSizeError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('maximum allowed size') ||
    lower.includes('payload too large') ||
    lower.includes('entity too large') ||
    lower.includes('object exceeded')
  );
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

  const sizeCap = maxImportBytes();

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
          canUploadLocally: true,
        },
        { status: 409 },
      );
    }

    // Probe sizes first so we can skip encodings that will fail storage upload.
    const probed: Array<{ url: string; size: number | null }> = [];
    for (const url of candidates) {
      probed.push({ url, size: await probeContentLength(url) });
    }

    const underCap = probed
      .filter((row) => row.size == null || row.size <= sizeCap)
      .sort((a, b) => {
        // Prefer known smaller files; unknowns keep original preference order.
        if (a.size == null && b.size == null) return 0;
        if (a.size == null) return 1;
        if (b.size == null) return -1;
        return a.size - b.size;
      });

    const tryOrder =
      underCap.length > 0
        ? underCap.map((row) => row.url)
        : candidates.slice(0, 1);

    let mediaRes: Response | null = null;
    let playUrl: string | null = null;
    let lastStatus = 0;
    let lastBytes: Buffer | null = null;

    for (const url of tryOrder) {
      const res = await downloadWithHotlinkReferer(url);
      lastStatus = res.status;
      if (!res.ok) continue;

      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength < 1000) continue;

      if (bytes.byteLength > sizeCap) {
        // Keep looking for a smaller encoding.
        continue;
      }

      mediaRes = res;
      playUrl = url;
      lastBytes = bytes;
      break;
    }

    if (!mediaRes || !playUrl || !lastBytes) {
      const smallestKnown = probed
        .filter((row) => row.size != null)
        .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))[0];

      return NextResponse.json(
        {
          error: smallestKnown?.size
            ? `Published encodings are too large to import automatically (smallest ~${formatMb(smallestKnown.size)}; limit ${formatMb(sizeCap)}). Upload a compressed local MP4 instead, or raise the Supabase Storage global file size limit.`
            : `Could not download a publish encoding under ${formatMb(sizeCap)} (${lastStatus || 'no response'}). Upload a local master instead.`,
          lastStatus,
          canUploadLocally: true,
          maxImportBytes: sizeCap,
        },
        { status: 413 },
      );
    }

    const bytes = lastBytes;
    const path = masterStoragePath(accountId, videoId);
    const { error: uploadError } = await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .upload(path, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      const message = uploadError.message || 'Upload failed';
      if (isStorageSizeError(message)) {
        return NextResponse.json(
          {
            error: `Storage rejected the master (${formatMb(bytes.byteLength)}). Raise the Supabase Storage global file size limit (Dashboard → Storage → Settings), or upload a smaller local MP4.`,
            canUploadLocally: true,
            byteSize: bytes.byteLength,
          },
          { status: 413 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
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
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to import master from published video';
    if (isStorageSizeError(message)) {
      return NextResponse.json(
        {
          error: `${message}. Raise the Supabase Storage global file size limit, or upload a smaller local MP4.`,
          canUploadLocally: true,
        },
        { status: 413 },
      );
    }
    return NextResponse.json(
      {
        error: message,
        canUploadLocally: true,
      },
      { status: 500 },
    );
  }
}
