import { createBunnyStreamClient } from '@kit/bunny';

import type { VideoRow } from './types';

function normalizeCdnHost(cdnHostname: string) {
  return cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function buildBunnyThumbnailCandidates(
  bunnyVideoId: string,
  cdnHostname: string,
): string[] {
  const host = normalizeCdnHost(cdnHostname);
  if (!host || !bunnyVideoId) return [];

  return [
    `https://${host}/${bunnyVideoId}/thumbnail.jpg`,
    `https://${host}/${bunnyVideoId}/preview.webp`,
    `https://${host}/${bunnyVideoId}/0.jpg`,
  ];
}

export function resolveVideoThumbnailUrl(
  video: Pick<
    VideoRow,
    'thumbnail_url' | 'bunny_video_id' | 'status' | 'bunny_library_id'
  >,
  cdnHostname: string,
): string | null {
  if (video.thumbnail_url?.trim()) {
    const url = video.thumbnail_url.trim();
    // Legacy URLs used /0.jpg which often 404s on Bunny Stream.
    if (url.endsWith('/0.jpg')) {
      return url.replace(/\/0\.jpg$/, '/thumbnail.jpg');
    }
    return url;
  }

  if (video.status !== 'ready' || !video.bunny_video_id) {
    return null;
  }

  const hostname = cdnHostname.trim();
  if (!hostname) {
    return null;
  }

  return createBunnyStreamClient().getThumbnailUrl(
    hostname,
    video.bunny_video_id,
  );
}

export function resolveVideoThumbnailCandidates(
  video: Pick<
    VideoRow,
    'thumbnail_url' | 'bunny_video_id' | 'status' | 'bunny_library_id'
  >,
  cdnHostname: string,
): string[] {
  const urls: string[] = [];
  const primary = resolveVideoThumbnailUrl(video, cdnHostname);

  if (primary) {
    urls.push(primary);
  }

  if (video.bunny_video_id && cdnHostname.trim()) {
    for (const candidate of buildBunnyThumbnailCandidates(
      video.bunny_video_id,
      cdnHostname,
    )) {
      if (!urls.includes(candidate)) {
        urls.push(candidate);
      }
    }
  }

  if (!urls.length) {
    urls.push(VIDEO_THUMB_PLACEHOLDER);
  }

  return urls;
}

export const VIDEO_THUMB_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%23111827" width="100%25" height="100%25"/%3E%3C/svg%3E';
