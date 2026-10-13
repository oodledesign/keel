import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { createVideoUploadForAccount } from '~/lib/videos/server/create-video-upload';
import { loadRecorderVideoFolder } from '~/lib/videos/server/recorder-video-folders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function planLimit(message: string) {
  return NextResponse.json({ error: message }, { status: 402 });
}

const bodySchema = z.object({
  account_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  original_filename: z.string().max(500).optional().nullable(),
  duration_seconds: z.number().int().positive().optional().nullable(),
  recorded_at: z.string().datetime().optional().nullable(),
  folder_id: z.string().uuid().optional().nullable(),
});

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid body');
  }

  const admin = getSupabaseServerAdminClient();
  const accountId = parsed.data.account_id;

  try {
    await assertWorkspaceMember(admin, accountId, auth.user_id);
  } catch {
    return forbidden('Invalid workspace for this token');
  }

  try {
    // A folder deleted on the web mid-edit shouldn't block the upload; land at the root instead.
    let folderId: string | null = null;
    if (parsed.data.folder_id) {
      const folder = await loadRecorderVideoFolder(
        admin,
        parsed.data.folder_id,
      );
      folderId = folder?.account_id === accountId ? folder.id : null;
    }

    const created = await createVideoUploadForAccount(admin, {
      accountId,
      folderId,
      title: parsed.data.title,
      originalFilename: parsed.data.original_filename ?? null,
      durationSeconds: parsed.data.duration_seconds ?? null,
      recordedAt: parsed.data.recorded_at ?? null,
      source: 'screen_recording',
    });

    if (!created.ok) {
      if (created.code === 'PLAN_LIMIT') {
        return planLimit(created.message);
      }
      return NextResponse.json({ error: created.message }, { status: 500 });
    }

    return NextResponse.json({
      video_id: created.data.videoId,
      bunny_video_id: created.data.bunnyVideoId,
      upload_url: created.data.uploadUrl,
      signature: created.data.signature,
      expiry: created.data.expiry,
      tus_endpoint: created.data.tusEndpoint,
      library_id: created.data.libraryId,
      cdn_hostname: created.data.cdnHostname,
    });
  } catch (error) {
    console.error('[recorder/videos/create-upload]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start video upload',
      },
      { status: 500 },
    );
  }
}
