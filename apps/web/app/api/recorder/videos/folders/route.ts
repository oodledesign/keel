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

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

const createSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  parent_folder_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return auth;

  const accountId = new URL(request.url).searchParams.get('account_id');
  if (!accountId || !z.string().uuid().safeParse(accountId).success) {
    return badRequest('account_id is required');
  }

  const admin = getSupabaseServerAdminClient();

  try {
    await assertWorkspaceMember(admin, accountId, auth.user_id);
  } catch {
    return forbidden('Invalid workspace for this token');
  }

  const { data, error } = await admin
    .from('video_folders')
    .select(RECORDER_VIDEO_FOLDER_COLUMNS)
    .eq('account_id', accountId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[recorder/videos/folders] GET', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const folders = (data ?? []) as RecorderVideoFolder[];
  return NextResponse.json({
    folders: folders.map(toRecorderFolderResponse),
  });
}

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid body');
  }

  const admin = getSupabaseServerAdminClient();
  const accountId = parsed.data.account_id;
  const parentFolderId = parsed.data.parent_folder_id ?? null;

  try {
    await assertWorkspaceMember(admin, accountId, auth.user_id);
  } catch {
    return forbidden('Invalid workspace for this token');
  }

  try {
    if (parentFolderId) {
      const parent = await loadRecorderVideoFolder(admin, parentFolderId);
      if (!parent || parent.account_id !== accountId) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 },
        );
      }
    }

    const { data, error } = await admin
      .from('video_folders')
      .insert({
        account_id: accountId,
        name: parsed.data.name,
        parent_folder_id: parentFolderId,
      })
      .select(RECORDER_VIDEO_FOLDER_COLUMNS)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create folder' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      folder: toRecorderFolderResponse(data as RecorderVideoFolder),
    });
  } catch (error) {
    console.error('[recorder/videos/folders] POST', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create folder',
      },
      { status: 500 },
    );
  }
}
