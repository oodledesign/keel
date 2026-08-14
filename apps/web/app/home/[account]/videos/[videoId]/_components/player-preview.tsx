'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { aspectRatioCss, buildEmbedUrl } from '~/lib/videos/embed';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export type PlayerPreviewHandle = {
  seekToPlaybackMs: (ms: number) => void;
};

export const PlayerPreview = forwardRef<
  PlayerPreviewHandle,
  {
    libraryId: string;
    bunnyVideoId: string;
    config: VideoPlayerConfigValues;
  }
>(function PlayerPreview(props, ref) {
  const debouncedConfig = useDebouncedValue(props.config, 500);
  const [startSeconds, setStartSeconds] = useState(0);
  const [seekKey, setSeekKey] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      seekToPlaybackMs: (ms: number) => {
        setStartSeconds(Math.max(0, Math.floor(ms / 1000)));
        setSeekKey((k) => k + 1);
      },
    }),
    [],
  );

  const embedUrl = useMemo(() => {
    const url = new URL(
      buildEmbedUrl(props.libraryId, props.bunnyVideoId, debouncedConfig),
    );
    if (startSeconds > 0) {
      url.searchParams.set('t', String(startSeconds));
      url.searchParams.set('autoplay', 'true');
    }
    return url.toString();
  }, [props.libraryId, props.bunnyVideoId, debouncedConfig, startSeconds]);

  const ratio = aspectRatioCss(debouncedConfig.aspect_ratio);
  const maxWidth = debouncedConfig.max_width_px
    ? `${debouncedConfig.max_width_px}px`
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Live preview</h3>
        <span className="text-muted-foreground text-xs">
          {debouncedConfig.aspect_ratio}
        </span>
      </div>

      <div
        className="mx-auto w-full overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/40"
        style={{ maxWidth }}
      >
        <div className="relative w-full" style={{ aspectRatio: ratio }}>
          <iframe
            key={`${seekKey}:${embedUrl}`}
            src={embedUrl}
            title="Player preview"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
});
