import { NextResponse } from 'next/server';

import { z } from 'zod';

import {
  type VideoEditTimeline,
  normalizeTimeline,
  suggestZoomsFromClicks,
} from '~/lib/videos/edit-timeline';
import {
  ensureEditProject,
  saveEditTimeline,
} from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const TimelineSchema = z.object({
  version: z.literal(1).optional(),
  sourceDurationMs: z.number(),
  keepRanges: z.array(z.object({ startMs: z.number(), endMs: z.number() })),
  clicks: z.array(z.object({ tMs: z.number(), x: z.number(), y: z.number() })),
  zooms: z.array(
    z.object({
      id: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      scale: z.number(),
      cx: z.number(),
      cy: z.number(),
      easeInMs: z.number(),
      easeOutMs: z.number(),
    }),
  ),
  clickStyle: z
    .object({
      enabled: z.boolean(),
      color: z.string(),
      radiusPx: z.number(),
      fadeMs: z.number(),
    })
    .optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const video = access.video!;
  const durationMs =
    video.duration_seconds != null ? Number(video.duration_seconds) * 1000 : 0;

  const { data: master } = await access.client
    .from('video_masters')
    .select('duration_ms')
    .eq('video_id', videoId)
    .maybeSingle();

  const { project, timeline } = await ensureEditProject({
    client: access.client,
    videoId,
    accountId: video.account_id as string,
    durationMs: master?.duration_ms ?? durationMs,
    userId: access.user?.id,
  });

  return NextResponse.json({
    ok: true,
    revision: project.revision,
    timeline,
    hasMaster: Boolean(video.has_master),
    editRevision: video.edit_revision ?? project.revision,
    publishedRevision: video.published_revision ?? 0,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = TimelineSchema.safeParse(json?.timeline ?? json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const timeline = normalizeTimeline(parsed.data) as VideoEditTimeline;
  const saved = await saveEditTimeline({
    client: access.client,
    videoId,
    accountId: access.video!.account_id as string,
    timeline,
    userId: access.user?.id,
  });

  return NextResponse.json({
    ok: true,
    revision: saved.revision,
    timeline: saved.timeline,
  });
}

/** POST ?action=suggest-zooms — merge auto-suggested zooms into the project. */
export async function POST(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'suggest-zooms';

  const video = access.video!;
  const durationMs =
    video.duration_seconds != null ? Number(video.duration_seconds) * 1000 : 0;

  const { data: master } = await access.client
    .from('video_masters')
    .select('duration_ms')
    .eq('video_id', videoId)
    .maybeSingle();

  const { timeline } = await ensureEditProject({
    client: access.client,
    videoId,
    accountId: video.account_id as string,
    durationMs: master?.duration_ms ?? durationMs,
    userId: access.user?.id,
  });

  if (action === 'suggest-zooms') {
    const suggestions = suggestZoomsFromClicks(
      timeline.clicks,
      timeline.sourceDurationMs,
      timeline.keepRanges,
    );
    const next: VideoEditTimeline = {
      ...timeline,
      zooms: suggestions,
    };
    const saved = await saveEditTimeline({
      client: access.client,
      videoId,
      accountId: video.account_id as string,
      timeline: next,
      userId: access.user?.id,
    });
    return NextResponse.json({
      ok: true,
      revision: saved.revision,
      timeline: saved.timeline,
      suggestedCount: suggestions.length,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
