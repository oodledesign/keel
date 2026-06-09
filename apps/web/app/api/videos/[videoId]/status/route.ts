import { type NextRequest } from 'next/server';

import { createBunnyStreamClient } from '@kit/bunny';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { mapBunnyStatusToVideoStatus } from '~/lib/videos/map-bunny-status';
import { getBunnyCdnHostname } from '~/lib/videos/server/videos-data';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const access = await requireVideoById(videoId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const video = access.video!;
    const bunny = createBunnyStreamClient();
    const bunnyVideo = await bunny.getVideo(
      String(video.bunny_library_id),
      String(video.bunny_video_id),
    );

    const status = mapBunnyStatusToVideoStatus(bunnyVideo.status);
    const cdnHostname = getBunnyCdnHostname();
    const thumbnailUrl =
      bunnyVideo.thumbnailUrl ??
      (cdnHostname
        ? bunny.getThumbnailUrl(cdnHostname, String(video.bunny_video_id))
        : null);
    const durationSeconds =
      bunnyVideo.length > 0 ? Math.round(bunnyVideo.length) : null;

    const { error } = await access.client
      .from('videos')
      .update({
        status,
        thumbnail_url: thumbnailUrl,
        duration_seconds: durationSeconds,
        file_size_bytes: bunnyVideo.storageSize || null,
      })
      .eq('id', videoId);

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk({
      status,
      thumbnailUrl,
      duration: durationSeconds,
      encodeProgress: bunnyVideo.encodeProgress,
    });
  } catch (error) {
    console.error('[videos] status GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to fetch status',
      500,
    );
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const access = await requireVideoById(videoId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const { error } = await access.client
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId);

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk({ status: 'processing' });
  } catch (error) {
    console.error('[videos] status POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update status',
      500,
    );
  }
}
