import { NextResponse } from 'next/server';

import { z } from 'zod';

import {
  type VideoEditTimeline,
  normalizeTimeline,
} from '~/lib/videos/edit-timeline';
import { buildPublicVideoWatchUrl } from '~/lib/videos/public-share';
import { publishTimelineInstant } from '~/lib/videos/server/video-edit.service';
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
  audio: z
    .object({
      mic: z.object({ gain: z.number(), muted: z.boolean() }),
      system: z.object({ gain: z.number(), muted: z.boolean() }),
    })
    .optional(),
});

/**
 * Instant publish: snapshot timeline for public watch (no Bunny wait).
 * Client may optionally kick off /edit/republish afterward for embeds.
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
  const parsed = TimelineSchema.safeParse(json?.timeline ?? json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const video = access.video!;
  const timeline = normalizeTimeline(parsed.data) as VideoEditTimeline;

  try {
    const result = await publishTimelineInstant({
      client: access.client,
      videoId,
      accountId: video.account_id as string,
      timeline,
      userId: access.user?.id,
    });

    return NextResponse.json({
      ok: true,
      revision: result.revision,
      publishedRevision: result.revision,
      timeline: result.timeline,
      watchUrl: buildPublicVideoWatchUrl(result.publicShareToken),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Publish failed',
      },
      { status: 500 },
    );
  }
}
