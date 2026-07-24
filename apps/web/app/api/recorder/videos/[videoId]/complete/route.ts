import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { buildPublicVideoWatchUrl } from '~/lib/videos/public-share';
import { generatePublicShareToken } from '~/lib/videos/public-share.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) return auth;

  const { videoId } = await context.params;
  const admin = getSupabaseServerAdminClient();

  const { data: video, error } = await admin
    .from('videos')
    .select(
      'id, account_id, status, public_share_enabled, public_share_token, bunny_video_id, bunny_library_id',
    )
    .eq('id', videoId)
    .maybeSingle();

  if (error) {
    console.error('[recorder/videos/complete]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!video) {
    return notFound('Video not found');
  }

  try {
    await assertWorkspaceMember(
      admin,
      video.account_id as string,
      auth.user_id,
    );
  } catch {
    return forbidden('Invalid workspace for this token');
  }

  const existingToken = video.public_share_token as string | null;
  const nextToken = existingToken ?? generatePublicShareToken();

  const { data: updated, error: updateError } = await admin
    .from('videos')
    .update({
      status: 'processing',
      public_share_enabled: true,
      public_share_token: nextToken,
    })
    .eq('id', videoId)
    .select('id, public_share_enabled, public_share_token, status')
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Failed to complete upload' },
      { status: 500 },
    );
  }

  const token = updated.public_share_token as string;
  const watchUrl = buildPublicVideoWatchUrl(token);

  return NextResponse.json({
    video_id: updated.id as string,
    status: updated.status as string,
    public_share_enabled: true,
    watch_url: watchUrl,
    embed_ready: true,
  });
}
