import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { buildPublicVideoWatchUrl } from '~/lib/videos/public-share';
import { generatePublicShareToken } from '~/lib/videos/public-share.server';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  enabled: z.boolean(),
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

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const video = access.video!;
    const existingToken = video.public_share_token as string | null | undefined;
    const nextToken =
      parsed.data.enabled && !existingToken
        ? generatePublicShareToken()
        : (existingToken ?? null);

    const { data, error } = await access.client
      .from('videos')
      .update({
        public_share_enabled: parsed.data.enabled,
        public_share_token: nextToken,
      })
      .eq('id', videoId)
      .select('public_share_enabled, public_share_token')
      .single();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    const token = data.public_share_token as string | null;
    const enabled = Boolean(data.public_share_enabled);

    return jsonOk({
      enabled,
      token,
      publicUrl: enabled && token ? buildPublicVideoWatchUrl(token) : null,
    });
  } catch (error) {
    console.error('[videos] public-share PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update public link',
      500,
    );
  }
}
