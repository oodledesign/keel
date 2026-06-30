'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { buildEmbedUrl } from '~/lib/videos/embed';
import { DEFAULT_PLAYER_CONFIG } from '~/lib/videos/player-config-types';
import type { VideoRow } from '~/lib/videos/types';

export function VideoPreviewDialog(props: {
  video: VideoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const video = props.video;
  const embedSrc =
    video && video.status === 'ready'
      ? buildEmbedUrl(video.bunny_library_id, video.bunny_video_id, {
          ...DEFAULT_PLAYER_CONFIG,
          autoplay: true,
          muted: true,
        })
      : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>{video?.title ?? 'Preview'}</DialogTitle>
          <DialogDescription className="sr-only">
            Video preview player
          </DialogDescription>
        </DialogHeader>

        {video?.status !== 'ready' ? (
          <p className="text-muted-foreground text-sm">
            This video is still {video?.status ?? 'loading'}. Preview is available
            once encoding finishes.
          </p>
        ) : embedSrc ? (
          <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-black">
            <iframe
              src={embedSrc}
              title={video.title}
              className="aspect-video w-full border-0"
              allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
