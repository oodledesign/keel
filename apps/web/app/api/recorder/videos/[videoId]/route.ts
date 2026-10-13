import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { loadRecorderVideoFolder } from '~/lib/videos/server/recorder-video-folders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

const patchSchema = z.object({
  folder_id: z.string().uuid().nullable(),
});

/** Moves a published recording between folders (Mac library "Move to folder"). */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return auth;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid body');
  }

  const { videoId } = await context.params;
  if (!z.string().uuid().safeParse(videoId).success) {
    return notFound('Video not found');
  }

  const admin = getSupabaseServerAdminClient();

  try {
    const { data: video, error } = await admin
      .from('videos')
      .select('id, account_id')
      .eq('id', videoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!video) return notFound('Video not found');

    try {
      await assertWorkspaceMember(admin, video.account_id, auth.user_id);
    } catch {
      return forbidden('Invalid workspace for this token');
    }

    const folderId = parsed.data.folder_id;
    if (folderId) {
      const folder = await loadRecorderVideoFolder(admin, folderId);
      if (!folder || folder.account_id !== video.account_id) {
        return notFound('Folder not found');
      }
    }

    const { error: updateError } = await admin
      .from('videos')
      .update({ folder_id: folderId })
      .eq('id', videoId);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ video_id: videoId, folder_id: folderId });
  } catch (error) {
    console.error('[recorder/videos/:id] PATCH', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to move video',
      },
      { status: 500 },
    );
  }
}
