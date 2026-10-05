import type { VideoRow } from './types';

/** Grace period so a brand-new upload isn't flagged before bytes start flowing. */
export const STALLED_UPLOAD_AFTER_MS = 3 * 60 * 1000;

/** Video ids this browser tab is uploading right now. */
const activeUploads = new Set<string>();

export function markUploadActive(videoId: string) {
  activeUploads.add(videoId);
}

export function markUploadInactive(videoId: string) {
  activeUploads.delete(videoId);
}

/**
 * A row still in `uploading` that this tab isn't uploading is one whose file
 * never finished arriving (page refreshed, tab closed, network lost). Bunny
 * leaves such videos at "created" forever, so they would sit there indefinitely.
 */
export function isStalledUpload(
  video: Pick<VideoRow, 'id' | 'status' | 'created_at'>,
  now: number,
  active: ReadonlySet<string> = activeUploads,
): boolean {
  if (video.status !== 'uploading') return false;
  if (active.has(video.id)) return false;
  return now - new Date(video.created_at).getTime() > STALLED_UPLOAD_AFTER_MS;
}
