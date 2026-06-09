import type { BunnyVideoStatus } from '@kit/bunny';

import type { VideoStatus } from './types';

export function mapBunnyStatusToVideoStatus(
  bunnyStatus: BunnyVideoStatus,
): VideoStatus {
  switch (bunnyStatus) {
    case 'finished':
      return 'ready';
    case 'error':
      return 'failed';
    case 'created':
    case 'uploaded':
      return 'uploading';
    default:
      return 'processing';
  }
}
