'use client';

import { useEffect, useMemo, useState } from 'react';

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

export function PlayerPreview(props: {
  libraryId: string;
  bunnyVideoId: string;
  config: VideoPlayerConfigValues;
}) {
  const debouncedConfig = useDebouncedValue(props.config, 500);

  const embedUrl = useMemo(
    () => buildEmbedUrl(props.libraryId, props.bunnyVideoId, debouncedConfig),
    [props.libraryId, props.bunnyVideoId, debouncedConfig],
  );

  const ratio = aspectRatioCss(debouncedConfig.aspect_ratio);
  const maxWidth = debouncedConfig.max_width_px
    ? `${debouncedConfig.max_width_px}px`
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
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
            key={embedUrl}
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
}
