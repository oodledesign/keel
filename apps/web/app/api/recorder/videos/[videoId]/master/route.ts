import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import type { VideoClickEvent } from '~/lib/videos/edit-timeline';
import {
  VIDEO_MASTERS_BUCKET,
  clicksStoragePath,
  ensureEditProject,
  masterStoragePath,
  micAudioStoragePath,
  systemAudioStoragePath,
  upsertDesktopTranscript,
  upsertVideoMaster,
} from '~/lib/videos/server/video-edit.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const BodySchema = z.object({
  contentType: z.string().optional(),
  byteSize: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  sha256: z.string().optional(),
  clicks: z
    .array(
      z.object({
        tMs: z.number(),
        x: z.number(),
        y: z.number(),
      }),
    )
    .optional(),
  /** Plain transcript from desktop Apple Speech (no word timings). */
  transcriptPlainText: z.string().optional(),
  /** Request signed upload URLs for separate mic / system AAC sidecars. */
  includeMicAudio: z.boolean().optional(),
  includeSystemAudio: z.boolean().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return auth;

  const { videoId } = await context.params;
  const admin = getSupabaseServerAdminClient();

  const { data: video, error } = await admin
    .from('videos')
    .select('id, account_id, duration_seconds')
    .eq('id', videoId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  try {
    await assertWorkspaceMember(
      admin,
      video.account_id as string,
      auth.user_id,
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid workspace for this token' },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const accountId = video.account_id as string;
  const path = masterStoragePath(accountId, videoId);
  const micPath = parsed.data.includeMicAudio
    ? micAudioStoragePath(accountId, videoId)
    : null;
  const systemPath = parsed.data.includeSystemAudio
    ? systemAudioStoragePath(accountId, videoId)
    : null;

  // Signed upload URL for the Mac app (or browser) to PUT the master.
  const { data: signed, error: signError } = await admin.storage
    .from(VIDEO_MASTERS_BUCKET)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message ?? 'Could not create upload URL' },
      { status: 500 },
    );
  }

  let micSignedUrl: string | null = null;
  let systemSignedUrl: string | null = null;
  if (micPath) {
    const { data: micSigned, error: micErr } = await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .createSignedUploadUrl(micPath);
    if (micErr || !micSigned) {
      return NextResponse.json(
        { error: micErr?.message ?? 'Could not create mic upload URL' },
        { status: 500 },
      );
    }
    micSignedUrl = micSigned.signedUrl;
  }
  if (systemPath) {
    const { data: sysSigned, error: sysErr } = await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .createSignedUploadUrl(systemPath);
    if (sysErr || !sysSigned) {
      return NextResponse.json(
        { error: sysErr?.message ?? 'Could not create system upload URL' },
        { status: 500 },
      );
    }
    systemSignedUrl = sysSigned.signedUrl;
  }

  const durationMs =
    parsed.data.durationMs ??
    (video.duration_seconds != null
      ? Number(video.duration_seconds) * 1000
      : null);

  await upsertVideoMaster({
    client: admin,
    videoId,
    accountId,
    storagePath: path,
    contentType: parsed.data.contentType ?? 'video/mp4',
    byteSize: parsed.data.byteSize ?? null,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    durationMs,
    sha256: parsed.data.sha256 ?? null,
    micStoragePath: micPath,
    systemStoragePath: systemPath,
  });

  const clicks = (parsed.data.clicks ?? []) as VideoClickEvent[];
  if (clicks.length > 0) {
    const clicksPath = clicksStoragePath(accountId, videoId);
    await admin.storage
      .from(VIDEO_MASTERS_BUCKET)
      .upload(clicksPath, JSON.stringify({ clicks }), {
        contentType: 'application/json',
        upsert: true,
      });
  }

  await ensureEditProject({
    client: admin,
    videoId,
    accountId,
    durationMs: durationMs ?? 0,
    clicks,
    userId: auth.user_id,
  });

  const transcriptPlainText = parsed.data.transcriptPlainText?.trim();
  if (transcriptPlainText) {
    await upsertDesktopTranscript({
      client: admin,
      videoId,
      accountId,
      plainText: transcriptPlainText,
      durationMs: durationMs ?? 0,
    });
  }

  return NextResponse.json({
    ok: true,
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
    bucket: VIDEO_MASTERS_BUCKET,
    micPath,
    micSignedUrl,
    systemPath,
    systemSignedUrl,
  });
}
