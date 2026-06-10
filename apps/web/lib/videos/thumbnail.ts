import { createBunnyStreamClient } from '@kit/bunny';

import type { VideoRow } from './types';

export function resolveVideoThumbnailUrl(
  video: Pick<VideoRow, 'thumbnail_url' | 'bunny_video_id' | 'status'>,
  cdnHostname: string,
): string | null {
  if (video.thumbnail_url?.trim()) {
    return video.thumbnail_url;
  }

  if (video.status !== 'ready' || !video.bunny_video_id || !cdnHostname.trim()) {
    return null;
  }

  return createBunnyStreamClient().getThumbnailUrl(
    cdnHostname,
    video.bunny_video_id,
  );
}

export const VIDEO_THUMB_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%23111827" width="100%25" height="100%25"/%3E%3C/svg%3E';
