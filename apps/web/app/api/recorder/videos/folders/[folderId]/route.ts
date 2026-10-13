import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  RECORDER_VIDEO_FOLDER_COLUMNS,
  type RecorderVideoFolder,
  loadRecorderVideoFolder,
  toRecorderFolderResponse,
} from '~/lib/videos/server/recorder-video-folders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ folderId: string }>;
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

function serverError(scope: string, error: unknown, fallback: string) {
  console.error(`[recorder/videos/folders/:id] ${scope}`, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

const renameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

async function resolveFolder(request: Request, context: RouteContext) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return { response: auth };

  const { folderId } = await context.params;
  if (!z.string().uuid().safeParse(folderId).success) {
    return { response: notFound('Folder not found') };
  }

  const admin = getSupabaseServerAdminClient();
  const folder = await loadRecorderVideoFolder(admin, folderId);
  if (!folder) {
    return { response: notFound('Folder not found') };
  }

  try {
    await assertWorkspaceMember(admin, folder.account_id, auth.user_id);
  } catch {
    return { response: forbidden('Invalid workspace for this token') };
  }

  return { admin, folder };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveFolder(request, context);
    if ('response' in resolved) return resolved.response;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parsed = renameSchema.safeParse(json);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid body');
    }

    const { data, error } = await resolved.admin
      .from('video_folders')
      .update({ name: parsed.data.name })
      .eq('id', resolved.folder.id)
      .select(RECORDER_VIDEO_FOLDER_COLUMNS)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to rename folder');
    }

    return NextResponse.json({
      folder: toRecorderFolderResponse(data as RecorderVideoFolder),
    });
  } catch (error) {
    return serverError('PATCH', error, 'Failed to rename folder');
  }
}

/**
 * Deletes the folder and moves its videos and subfolders up one level, so
 * nothing in the account is lost or orphaned at the library root unexpectedly.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveFolder(request, context);
    if ('response' in resolved) return resolved.response;

    const { admin, folder } = resolved;
    const parentId = folder.parent_folder_id;

    const { error: videosError } = await admin
      .from('videos')
      .update({ folder_id: parentId })
      .eq('account_id', folder.account_id)
      .eq('folder_id', folder.id);
    if (videosError) throw new Error(videosError.message);

    const { error: childrenError } = await admin
      .from('video_folders')
      .update({ parent_folder_id: parentId })
      .eq('account_id', folder.account_id)
      .eq('parent_folder_id', folder.id);
    if (childrenError) throw new Error(childrenError.message);

    const { error } = await admin
      .from('video_folders')
      .delete()
      .eq('id', folder.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, parent_folder_id: parentId });
  } catch (error) {
    return serverError('DELETE', error, 'Failed to delete folder');
  }
}
