'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  TimelinePlaybackPlayer,
  type TimelinePlaybackPlayerHandle,
} from '~/components/videos/timeline-playback-player';
import {
  type VideoEditTimeline,
  editedMsToSourceMs,
  normalizeTimeline,
} from '~/lib/videos/edit-timeline';

type MediaPayload = {
  masterUrl: string;
  micUrl: string | null;
  systemUrl: string | null;
  timeline: VideoEditTimeline;
};

type Props = {
  token: string;
  aspectRatio: string;
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
    void fetch(`/api/watch/${props.token}/media`, {
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
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load video');
      });
    return () => controller.abort();
  }, [props.token]);

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
        className="absolute inset-0"
      />
    </div>
  );
});
