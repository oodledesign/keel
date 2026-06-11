import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { createBunnyStreamClient } from '@kit/bunny';

import { assertVideoCreateAllowed } from '~/lib/billing/entitlements';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  getBunnyCdnHostname,
  resolveAccountBunnyApiKey,
  resolveAccountBunnyLibraryId,
} from '~/lib/videos/server/videos-data';
import { requireVideoAccountAccess } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  accountId: z.string().uuid(),
  title: z.string().min(1).max(500),
  folderId: z.string().uuid().nullable().optional(),
  originalFilename: z.string().max(500).optional(),
  libraryId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const access = await requireVideoAccountAccess(parsed.data.accountId);
    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const accountId = parsed.data.accountId;

    const { count: videoCount } = await access.client
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    const limitCheck = await assertVideoCreateAllowed(
      access.client,
      accountId,
      videoCount ?? 0,
    );

    if (!limitCheck.allowed) {
      return jsonErr(
        'PLAN_LIMIT',
        limitCheck.reason ?? 'Video limit reached for your plan',
        402,
      );
    }

    const libraryId =
      parsed.data.libraryId?.trim() ||
      (await resolveAccountBunnyLibraryId(access.client, parsed.data.accountId));
    const apiKey = await resolveAccountBunnyApiKey(
      access.client,
      parsed.data.accountId,
    );
    const bunny = createBunnyStreamClient(apiKey);
    const created = await bunny.createVideo(libraryId, parsed.data.title);

    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    const { signature } = bunny.getUploadSignature(
      libraryId,
      created.videoId,
      expiry,
    );

    const { data: row, error } = await access.client
      .from('videos')
      .insert({
        account_id: parsed.data.accountId,
        folder_id: parsed.data.folderId ?? null,
        title: parsed.data.title,
        bunny_video_id: created.videoId,
        bunny_library_id: libraryId,
        status: 'uploading',
        original_filename: parsed.data.originalFilename ?? null,
      })
      .select('id')
      .single();

    if (error || !row) {
      return jsonErr('DB_ERROR', error?.message ?? 'Failed to create video', 500);
    }

    return jsonOk({
      videoId: row.id as string,
      bunnyVideoId: created.videoId,
      uploadUrl: created.uploadUrl,
      signature,
      expiry,
      tusEndpoint: 'https://video.bunnycdn.com/tusupload',
      libraryId,
      cdnHostname: getBunnyCdnHostname(),
    });
  } catch (error) {
    console.error('[videos] create-upload', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to start upload',
      500,
    );
  }
}
