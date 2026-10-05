'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ImageIcon, Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { formatDuration } from '~/lib/videos/format';

const MAX_WIDTH = 1280;

type ApiResult = { ok: true } | { ok: false; error: { message: string } };

/**
 * Pick any frame of the video as its thumbnail. The frame is drawn from a
 * muted <video> into a canvas in the browser and uploaded as a JPEG.
 */
export function VideoThumbnailPanel(props: {
  videoId: string;
  /** Direct MP4 URL (CDN), or null when no CDN host is configured. */
  mp4Url: string | null;
  currentThumbnailUrl: string | null;
  isCustom: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);

  if (!props.mp4Url || props.disabled) return null;

  const seek = (next: number) => {
    setTime(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  };

  const save = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setBusy('save');
    try {
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not read the frame');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Throws a SecurityError if the CDN didn't allow cross-origin pixels.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.88),
      );
      if (!blob) throw new Error('Could not capture this frame');

      const body = new FormData();
      body.append('file', blob, 'thumbnail.jpg');
      const res = await fetch(`/api/videos/${props.videoId}/thumbnail`, {
        method: 'POST',
        body,
      });
      const json = (await res.json()) as ApiResult;
      if (!json.ok) throw new Error(json.error.message);

      toast.success('Thumbnail updated');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy('reset');
    try {
      const res = await fetch(`/api/videos/${props.videoId}/thumbnail`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as ApiResult;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Thumbnail reset');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <ImageIcon className="h-4 w-4" aria-hidden />
          Thumbnail
        </h3>
        {props.isCustom ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={busy !== null}
            onClick={() => void reset()}
          >
            {busy === 'reset' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Use default
          </Button>
        ) : null}
      </div>

      {loadFailed ? (
        <p className="text-muted-foreground text-sm">
          Couldn’t load the video to pick a frame. It may still be processing.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Current</Label>
            <div className="aspect-video overflow-hidden rounded-lg bg-black/40">
              {props.currentThumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.currentThumbnailUrl}
                  alt="Current thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Pick a frame · {formatDuration(Math.round(time))}
            </Label>
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                src={props.mp4Url}
                crossOrigin="anonymous"
                muted
                playsInline
                preload="auto"
                className="h-full w-full object-contain"
                onLoadedMetadata={(event) =>
                  setDuration(event.currentTarget.duration || 0)
                }
                onError={() => setLoadFailed(true)}
              />
            </div>
          </div>
        </div>
      )}

      {!loadFailed ? (
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={time}
            disabled={duration === 0 || busy !== null}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Scrub to choose a thumbnail frame"
            className="w-full accent-[var(--ozer-accent)]"
          />
          <Button
            type="button"
            size="sm"
            disabled={duration === 0 || busy !== null}
            onClick={() => void save()}
          >
            {busy === 'save' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Use this frame'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
