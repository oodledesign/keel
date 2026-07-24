import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createBunnyStreamClient } from '@kit/bunny';

import { assertVideoCreateAllowed } from '~/lib/billing/entitlements';
import {
  getBunnyCdnHostname,
  resolveAccountBunnyApiKey,
  resolveAccountBunnyLibraryId,
} from '~/lib/videos/server/videos-data';

export type CreateVideoUploadInput = {
  accountId: string;
  title: string;
  folderId?: string | null;
  originalFilename?: string | null;
  source?: 'upload' | 'screen_recording';
  recordedAt?: string | null;
  durationSeconds?: number | null;
};

export type CreateVideoUploadResult = {
  videoId: string;
  bunnyVideoId: string;
  uploadUrl?: string;
  signature: string;
  expiry: number;
  tusEndpoint: string;
  libraryId: string;
  cdnHostname: string | null;
};

export async function createVideoUploadForAccount(
  client: SupabaseClient,
  input: CreateVideoUploadInput,
): Promise<
  | { ok: true; data: CreateVideoUploadResult }
  | { ok: false; code: 'PLAN_LIMIT' | 'DB_ERROR'; message: string }
> {
  const { count: videoCount } = await client
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', input.accountId);

  const limitCheck = await assertVideoCreateAllowed(
    client,
    input.accountId,
    videoCount ?? 0,
  );

  if (!limitCheck.allowed) {
    return {
      ok: false,
      code: 'PLAN_LIMIT',
      message: limitCheck.reason ?? 'Video limit reached for your plan',
    };
  }

  const libraryId = await resolveAccountBunnyLibraryId(client, input.accountId);
  const apiKey = await resolveAccountBunnyApiKey(client, input.accountId);
  const bunny = createBunnyStreamClient(apiKey);
  const created = await bunny.createVideo(libraryId, input.title);

  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const { signature } = bunny.getUploadSignature(
    libraryId,
    created.videoId,
    expiry,
  );

  const { data: row, error } = await client
    .from('videos')
    .insert({
      account_id: input.accountId,
      folder_id: input.folderId ?? null,
      title: input.title,
      bunny_video_id: created.videoId,
      bunny_library_id: libraryId,
      status: 'uploading',
      original_filename: input.originalFilename ?? null,
      source: input.source ?? 'upload',
      recorded_at: input.recordedAt ?? null,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select('id')
    .single();

  if (error || !row) {
    return {
      ok: false,
      code: 'DB_ERROR',
      message: error?.message ?? 'Failed to create video',
    };
  }

  return {
    ok: true,
    data: {
      videoId: row.id as string,
      bunnyVideoId: created.videoId,
      uploadUrl: created.uploadUrl,
      signature,
      expiry,
      tusEndpoint: 'https://video.bunnycdn.com/tusupload',
      libraryId,
      cdnHostname: getBunnyCdnHostname(),
    },
  };
}
