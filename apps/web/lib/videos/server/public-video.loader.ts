import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { resolveEffectivePlayerConfig } from './player-config-data';
import { resolveBunnyCdnHostname } from './videos-data';
import {
  resolveVideoThumbnailCandidates,
  resolveVideoThumbnailUrl,
} from '../thumbnail';
import type { VideoRow } from '../types';
import type { VideoPlayerConfigValues } from '../player-config-types';

export type PublicVideoPageData = {
  video: VideoRow;
  config: VideoPlayerConfigValues;
};

export async function loadPublicVideoByToken(
  token: string,
): Promise<PublicVideoPageData | null> {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await admin
    .from('videos')
    .select('*')
    .eq('public_share_token', token)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const video = data as VideoRow;
  const resolved = await resolveEffectivePlayerConfig(
    admin,
    video.account_id,
    video.id,
  );

  const cdnHostname = await resolveBunnyCdnHostname(video.bunny_library_id);
  const thumbnail_url =
    resolveVideoThumbnailUrl(video, cdnHostname) ?? video.thumbnail_url;
  const thumbnail_candidates = resolveVideoThumbnailCandidates(
    { ...video, thumbnail_url },
    cdnHostname,
  );

  return {
    video: {
      ...video,
      thumbnail_url,
      thumbnail_candidates,
    },
    config: resolved.config,
  };
}
