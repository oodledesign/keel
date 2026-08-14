import { NextResponse } from 'next/server';

import { z } from 'zod';

import { createBunnyStreamClient } from '@kit/bunny';

import { requireVideoById } from '~/lib/videos/server/videos-access';
import {
  getBunnyCdnHostname,
  resolveAccountBunnyApiKey,
} from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const BodySchema = z.object({
  jobId: z.string().uuid(),
  bunnyVideoId: z.string().min(1),
  durationSeconds: z.number().optional(),
});

/**
 * Finish republish: swap bunny_video_id on the video row, delete old Stream
 * asset, bump published_revision. Public /watch/{token} stays stable.
 */
export async function POST(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const video = access.video!;
  const { data: job } = await access.client
    .from('video_export_jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .eq('video_id', videoId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json(
      { error: 'Export job not found' },
      { status: 404 },
    );
  }

  if (
    job.output_bunny_video_id &&
    job.output_bunny_video_id !== parsed.data.bunnyVideoId
  ) {
    return NextResponse.json(
      { error: 'Bunny video id does not match export job' },
      { status: 400 },
    );
  }

  const oldBunnyId = String(video.bunny_video_id);
  const libraryId = String(video.bunny_library_id);
  const editRevision =
    Number(job.edit_revision) || Number(video.edit_revision) || 0;

  const { error: updateError } = await access.client
    .from('videos')
    .update({
      bunny_video_id: parsed.data.bunnyVideoId,
      status: 'processing',
      baked_revision: editRevision,
      duration_seconds: parsed.data.durationSeconds ?? video.duration_seconds,
      thumbnail_url: null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await access.client
    .from('video_export_jobs')
    .update({
      status: 'completed',
      progress: 1,
      output_bunny_video_id: parsed.data.bunnyVideoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // Best-effort delete of previous Stream asset (watch URL unaffected).
  if (oldBunnyId && oldBunnyId !== parsed.data.bunnyVideoId) {
    try {
      const apiKey = await resolveAccountBunnyApiKey(
        access.client,
        video.account_id as string,
      );
      const bunny = createBunnyStreamClient(apiKey);
      await bunny.deleteVideo(libraryId, oldBunnyId);
    } catch (err) {
      console.warn(
        '[videos/edit/republish] delete old bunny video:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    bunnyVideoId: parsed.data.bunnyVideoId,
    bakedRevision: editRevision,
    publishedRevision: Number(video.published_revision ?? 0),
    cdnHostname: getBunnyCdnHostname(),
  });
}
