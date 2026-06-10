import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createBunnyStreamClient } from '@kit/bunny';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { VideoFolderRow, VideoRow } from '../types';
import { decryptVideoSecret } from '../crypto-secrets';
import {
  resolveVideoThumbnailCandidates,
  resolveVideoThumbnailUrl,
} from '../thumbnail';
import { loadAccountVideoSettings } from './player-config-data';

let cachedCdnHostname: string | null | undefined;

export async function loadVideoLibrary(accountId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;

  const [foldersResult, videosResult] = await Promise.all([
    client
      .from('video_folders')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true }),
    client
      .from('videos')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
  ]);

  if (foldersResult.error) throw new Error(foldersResult.error.message);
  if (videosResult.error) throw new Error(videosResult.error.message);

  const cdnHostname = await resolveBunnyCdnHostname();
  const videos = ((videosResult.data ?? []) as VideoRow[]).map((video) => ({
    ...video,
    thumbnail_url: resolveVideoThumbnailUrl(video, cdnHostname),
    thumbnail_candidates: resolveVideoThumbnailCandidates(video, cdnHostname),
  }));

  return {
    folders: (foldersResult.data ?? []) as VideoFolderRow[],
    videos,
  };
}

export function getDefaultBunnyLibraryId() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  if (!libraryId) {
    throw new Error('BUNNY_STREAM_LIBRARY_ID is not configured');
  }
  return libraryId;
}

export async function resolveAccountBunnyLibraryId(
  client: SupabaseClient,
  accountId: string,
) {
  const settings = await loadAccountVideoSettings(client, accountId);
  return settings.bunny_library_id?.trim() || getDefaultBunnyLibraryId();
}

export async function resolveAccountBunnyApiKey(
  client: SupabaseClient,
  accountId: string,
) {
  const settings = await loadAccountVideoSettings(client, accountId);
  if (settings.bunny_api_key_encrypted) {
    return decryptVideoSecret(settings.bunny_api_key_encrypted);
  }

  const envKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!envKey) {
    throw new Error('BUNNY_STREAM_API_KEY is not configured');
  }

  return envKey;
}

export function getBunnyCdnHostname() {
  return process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim() ?? '';
}

export async function resolveBunnyCdnHostname(libraryId?: string) {
  const fromEnv = getBunnyCdnHostname();
  if (fromEnv) {
    return fromEnv;
  }

  if (cachedCdnHostname !== undefined) {
    return cachedCdnHostname ?? '';
  }

  try {
    const bunny = createBunnyStreamClient();
    const library = await bunny.getLibrary(libraryId ?? getDefaultBunnyLibraryId());
    cachedCdnHostname = library.hostname;
  } catch {
    cachedCdnHostname = null;
  }

  return cachedCdnHostname ?? '';
}
