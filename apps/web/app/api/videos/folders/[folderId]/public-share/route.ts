import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { buildPublicFolderWatchUrl } from '~/lib/videos/public-share';
import { generatePublicShareToken } from '~/lib/videos/public-share.server';
import { requireVideoFolderById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  enabled: z.boolean(),
});

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const access = await requireVideoFolderById(folderId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Folder not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const folder = access.folder!;
    const existingToken = folder.public_share_token as
      | string
      | null
      | undefined;
    // Keep the token across off/on so a re-enabled link is the same URL.
    const nextToken =
      parsed.data.enabled && !existingToken
        ? generatePublicShareToken()
        : (existingToken ?? null);

    const { data, error } = await access.client
      .from('video_folders')
      .update({
        public_share_enabled: parsed.data.enabled,
        public_share_token: nextToken,
      })
      .eq('id', folderId)
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
      publicUrl: enabled && token ? buildPublicFolderWatchUrl(token) : null,
    });
  } catch (error) {
    console.error('[videos] folder public-share PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update public link',
      500,
    );
  }
}
