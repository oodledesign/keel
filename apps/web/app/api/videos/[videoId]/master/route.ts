import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  VIDEO_MASTERS_BUCKET,
  createSignedMasterUrl,
  ensureEditProject,
  masterStoragePath,
  upsertVideoMaster,
} from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const InitSchema = z.object({
  contentType: z.string().optional(),
  byteSize: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

/** GET — signed playback URL for the master (editor scrubbing). */
export async function GET(_request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: master } = await access.client
    .from('video_masters')
    .select('*')
    .eq('video_id', videoId)
    .maybeSingle();

  if (!master) {
    return NextResponse.json({ error: 'No master uploaded' }, { status: 404 });
  }

  let url: string;
  try {
    url = await createSignedMasterUrl(String(master.storage_path));
  } catch {
    // Row exists but the storage object was never uploaded / was deleted.
    return NextResponse.json(
      {
        error: 'Master file missing from storage',
        code: 'MASTER_MISSING',
        canImportFromStream: true,
      },
      { status: 404 },
    );
  }

  let micUrl: string | null = null;
  let systemUrl: string | null = null;
  if (master.mic_storage_path) {
    try {
      micUrl = await createSignedMasterUrl(String(master.mic_storage_path));
    } catch {
      micUrl = null;
    }
  }
  if (master.system_storage_path) {
    try {
      systemUrl = await createSignedMasterUrl(
        String(master.system_storage_path),
      );
    } catch {
      systemUrl = null;
    }
  }

  return NextResponse.json({
    ok: true,
    url,
    micUrl,
    systemUrl,
    master: {
      durationMs: master.duration_ms,
      width: master.width,
      height: master.height,
      byteSize: master.byte_size,
      contentType: master.content_type,
      hasMicAudio: Boolean(master.mic_storage_path),
      hasSystemAudio: Boolean(master.system_storage_path),
    },
  });
}

/** POST — create signed upload URL for attaching a master from the web app. */
export async function POST(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const video = access.video!;
  const json = await request.json().catch(() => ({}));
  const parsed = InitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const accountId = video.account_id as string;
  const path = masterStoragePath(accountId, videoId);
  const admin = getSupabaseServerAdminClient();

  const { data: signed, error: signError } = await admin.storage
    .from(VIDEO_MASTERS_BUCKET)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message ?? 'Could not create upload URL' },
      { status: 500 },
    );
  }

  const durationMs =
    parsed.data.durationMs ??
    (video.duration_seconds != null
      ? Number(video.duration_seconds) * 1000
      : null);

  await upsertVideoMaster({
    client: access.client,
    videoId,
    accountId,
    storagePath: path,
    contentType: parsed.data.contentType ?? 'video/mp4',
    byteSize: parsed.data.byteSize ?? null,
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
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
  });
}
