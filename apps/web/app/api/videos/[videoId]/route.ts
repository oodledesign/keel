import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { createBunnyStreamClient } from '@kit/bunny';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title != null) patch.title = parsed.data.title;
    if (parsed.data.folderId !== undefined)
      patch.folder_id = parsed.data.folderId;

    const { data, error } = await access.client
      .from('videos')
      .update(patch)
      .eq('id', videoId)
      .select('*')
      .single();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk({ video: data });
  } catch (error) {
    console.error('[videos] PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update video',
      500,
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
    try {
      const bunny = createBunnyStreamClient();
      await bunny.deleteVideo(
        String(video.bunny_library_id),
        String(video.bunny_video_id),
      );
    } catch (bunnyError) {
      console.error('[videos] bunny delete failed', bunnyError);
    }

    const { error } = await access.client
      .from('videos')
      .delete()
      .eq('id', videoId);
    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    console.error('[videos] DELETE', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to delete video',
      500,
    );
  }
}
