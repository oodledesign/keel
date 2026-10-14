'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  TimelinePlaybackPlayer,
  type TimelinePlaybackPlayerHandle,
} from '~/components/videos/timeline-playback-player';
import type { CaptionCue } from '~/lib/videos/captions';
import {
  type VideoEditTimeline,
  editedMsToSourceMs,
  normalizeTimeline,
  sourceMsToEditedMsClamped,
} from '~/lib/videos/edit-timeline';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

type MediaPayload = {
  masterUrl: string;
  micUrl: string | null;
  systemUrl: string | null;
  timeline: VideoEditTimeline;
  captions: CaptionCue[];
};

type Props = {
  /** Authorised media endpoint for this video (token- or folder-gated). */
  mediaUrl: string;
  aspectRatio: string;
  config: VideoPlayerConfigValues;
  onUnsupported?: () => void;
  /** Playback (edited) milliseconds as the video plays. */
  onPlaybackTime?: (ms: number) => void;
};

export type PublicTimelineWatchPlayerHandle = {
  /** Seek using playback (edited) milliseconds. */
  seekToPlaybackMs: (ms: number) => void;
};

export const PublicTimelineWatchPlayer = forwardRef<
  PublicTimelineWatchPlayerHandle,
  Props
>(function PublicTimelineWatchPlayer(props, ref) {
  const [media, setMedia] = useState<MediaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<TimelinePlaybackPlayerHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      seekToPlaybackMs: (ms: number) => {
        if (!media) return;
        const sourceMs =
          editedMsToSourceMs(media.timeline.keepRanges, ms) ?? ms;
        playerRef.current?.seekToSourceMs(sourceMs);
      },
    }),
    [media],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetch(props.mediaUrl, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? 'Could not load edited video');
        }
        setMedia({
          masterUrl: json.masterUrl as string,
          micUrl: (json.micUrl as string | null) ?? null,
          systemUrl: (json.systemUrl as string | null) ?? null,
          timeline: normalizeTimeline(json.timeline),
          captions: Array.isArray(json.captions)
            ? (json.captions as CaptionCue[])
            : [],
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load video');
      });
    return () => controller.abort();
  }, [props.mediaUrl]);

  const keepRanges = media?.timeline.keepRanges;
  const onPlaybackTime = props.onPlaybackTime;
  const onPlayheadChange = useCallback(
    (sourceMs: number) => {
      if (!onPlaybackTime || !keepRanges) return;
      onPlaybackTime(
        keepRanges.length > 0
          ? sourceMsToEditedMsClamped(keepRanges, sourceMs)
          : sourceMs,
      );
    },
    [onPlaybackTime, keepRanges],
  );

  if (error) {
    return (
      <div
        className="flex w-full items-center justify-center bg-black/60 text-sm text-white/80"
        style={{ aspectRatio: props.aspectRatio }}
      >
        {error}
      </div>
    );
  }

  if (!media) {
    return (
      <div
        className="flex w-full items-center justify-center bg-black text-sm text-white/70"
        style={{ aspectRatio: props.aspectRatio }}
      >
        Loading edited video…
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: props.aspectRatio }}>
      <TimelinePlaybackPlayer
        playerRef={playerRef}
        masterUrl={media.masterUrl}
        micUrl={media.micUrl}
        systemUrl={media.systemUrl}
        timeline={media.timeline}
        controls={props.config}
        captions={media.captions}
        onUnsupported={props.onUnsupported}
        onPlayheadChange={onPlayheadChange}
        className="absolute inset-0"
      />
    </div>
  );
});
