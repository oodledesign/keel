import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  clicksStoragePath,
  masterStoragePath,
  upsertVideoMaster,
  ensureEditProject,
  VIDEO_MASTERS_BUCKET,
} from '~/lib/videos/server/video-edit.service';
import type { VideoClickEvent } from '~/lib/videos/edit-timeline';

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

  return NextResponse.json({
    ok: true,
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
    bucket: VIDEO_MASTERS_BUCKET,
  });
}
