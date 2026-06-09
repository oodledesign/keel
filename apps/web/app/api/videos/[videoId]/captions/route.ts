import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { createBunnyStreamClient } from '@kit/bunny';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const querySchema = z.object({
  srclang: z.string().min(2).max(12),
  label: z.string().min(1).max(120),
});

export async function POST(request: NextRequest, context: RouteContext) {
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

    const form = await request.formData();
    const file = form.get('file');
    const meta = querySchema.safeParse({
      srclang: form.get('srclang'),
      label: form.get('label'),
    });

    if (!meta.success || !(file instanceof File)) {
      return jsonErr('VALIDATION', 'Invalid caption upload', 400);
    }

    const video = access.video!;
    const bunny = createBunnyStreamClient();
    await bunny.uploadCaption(
      String(video.bunny_library_id),
      String(video.bunny_video_id),
      {
        srclang: meta.data.srclang,
        label: meta.data.label,
        file,
      },
    );

    const captions = await bunny.listCaptions(
      String(video.bunny_library_id),
      String(video.bunny_video_id),
    );

    return jsonOk({ captions });
  } catch (error) {
    console.error('[videos] captions POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Caption upload failed',
      500,
    );
  }
}
