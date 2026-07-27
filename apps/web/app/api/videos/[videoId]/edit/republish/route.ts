import { NextResponse } from 'next/server';

import { createBunnyStreamClient } from '@kit/bunny';

import { requireVideoById } from '~/lib/videos/server/videos-access';
import {
  resolveAccountBunnyApiKey,
  resolveAccountBunnyLibraryId,
} from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

/**
 * Start a republish: create a new Bunny Stream video for the edited bake.
 * Client uploads via TUS, then calls /edit/republish/complete.
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
  if (!video.has_master) {
    return NextResponse.json(
      { error: 'Upload a master recording before publishing edits.' },
      { status: 400 },
    );
  }

  const { data: project } = await access.client
    .from('video_edit_projects')
    .select('revision')
    .eq('video_id', videoId)
    .maybeSingle();

  const { data: job, error: jobError } = await access.client
    .from('video_export_jobs')
    .insert({
      video_id: videoId,
      account_id: video.account_id,
      status: 'uploading',
      progress: 0,
      requested_by: access.user?.id ?? null,
      edit_revision: project?.revision ?? video.edit_revision ?? 0,
    })
    .select('*')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? 'Could not create export job' },
      { status: 500 },
    );
  }

  const libraryId = await resolveAccountBunnyLibraryId(
    access.client,
    video.account_id as string,
  );
  const apiKey = await resolveAccountBunnyApiKey(
    access.client,
    video.account_id as string,
  );
  const bunny = createBunnyStreamClient(apiKey);
  const created = await bunny.createVideo(
    libraryId,
    `${video.title as string} (edited)`,
  );

  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const { signature } = bunny.getUploadSignature(
    libraryId,
    created.videoId,
    expiry,
  );

  await access.client
    .from('video_export_jobs')
    .update({
      output_bunny_video_id: created.videoId,
      status: 'uploading',
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    bunnyVideoId: created.videoId,
    libraryId,
    signature,
    expiry,
    tusEndpoint: 'https://video.bunnycdn.com/tusupload',
    // Note: we intentionally do NOT insert a new videos row — we will swap
    // bunny_video_id on the existing row after upload completes.
  });
}
