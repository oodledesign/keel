import { type NextRequest } from 'next/server';

import { createBunnyStreamClient } from '@kit/bunny';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const BUCKET = 'video-thumbnails';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/webp', 'image/png'];

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

async function authorise(videoId: string) {
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return { response: jsonErr('UNAUTHORIZED', 'Sign in required', 401) };
  }
  if (access.error === 'NOT_FOUND') {
    return { response: jsonErr('NOT_FOUND', 'Video not found', 404) };
  }
  if (access.error === 'FORBIDDEN') {
    return {
      response: jsonErr('FORBIDDEN', 'Not a member of this account', 403),
    };
  }
  return { access };
}

/** Save a frame the user picked as the video's thumbnail (multipart `file`). */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const auth = await authorise(videoId);
    if (auth.response) return auth.response;
    const { access } = auth;
    const video = access.video!;

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return jsonErr('VALIDATION', 'Image file required', 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonErr('VALIDATION', 'Use a JPEG, WebP or PNG image', 400);
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return jsonErr('VALIDATION', 'Image must be under 5 MB', 400);
    }

    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const accountId = String(video.account_id);
    // New path per save so CDNs and browsers never serve a stale frame.
    const path = `${accountId}/${videoId}/${Date.now()}.${ext}`;

    const admin = getSupabaseServerAdminClient();
    const bucket = admin.storage.from(BUCKET);
    const { error: uploadError } = await bucket.upload(
      path,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, cacheControl: '31536000' },
    );
    if (uploadError) {
      return jsonErr('STORAGE_ERROR', uploadError.message, 500);
    }

    const thumbnailUrl = bucket.getPublicUrl(path).data.publicUrl;

    const { error } = await access.client
      .from('videos')
      .update({ thumbnail_url: thumbnailUrl, thumbnail_custom: true })
      .eq('id', videoId);
    if (error) {
      await bucket.remove([path]);
      return jsonErr('DB_ERROR', error.message, 500);
    }

    // Best effort: also update the embedded player's poster.
    try {
      await createBunnyStreamClient().setThumbnail(
        String(video.bunny_library_id),
        String(video.bunny_video_id),
        thumbnailUrl,
      );
    } catch (bunnyError) {
      console.warn('[videos] Bunny setThumbnail failed', bunnyError);
    }

    await removeOldThumbnails(bucket, `${accountId}/${videoId}`, path);

    return jsonOk({ thumbnailUrl });
  } catch (error) {
    console.error('[videos] thumbnail POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to save thumbnail',
      500,
    );
  }
}

/** Go back to the thumbnail Bunny generates. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const auth = await authorise(videoId);
    if (auth.response) return auth.response;
    const { access } = auth;

    const { error } = await access.client
      .from('videos')
      .update({ thumbnail_url: null, thumbnail_custom: false })
      .eq('id', videoId);
    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    const admin = getSupabaseServerAdminClient();
    await removeOldThumbnails(
      admin.storage.from(BUCKET),
      `${String(access.video!.account_id)}/${videoId}`,
      null,
    );

    return jsonOk({ reset: true });
  } catch (error) {
    console.error('[videos] thumbnail DELETE', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to reset thumbnail',
      500,
    );
  }
}

async function removeOldThumbnails(
  bucket: ReturnType<
    ReturnType<typeof getSupabaseServerAdminClient>['storage']['from']
  >,
  folder: string,
  keep: string | null,
) {
  const { data } = await bucket.list(folder);
  const stale = (data ?? [])
    .map((entry) => `${folder}/${entry.name}`)
    .filter((path) => path !== keep);
  if (stale.length > 0) await bucket.remove(stale);
}
