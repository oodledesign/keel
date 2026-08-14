'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

import { aspectRatioCss, buildEmbedUrl } from '~/lib/videos/embed';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

export type SeekableBunnyEmbedHandle = {
  seekToPlaybackMs: (ms: number) => void;
};

type Props = {
  libraryId: string;
  bunnyVideoId: string;
  config: VideoPlayerConfigValues;
  title: string;
  className?: string;
};

/**
 * Bunny iframe wrapper that remounts with `t` (start seconds) for chapter seeks.
 */
export const SeekableBunnyEmbed = forwardRef<SeekableBunnyEmbedHandle, Props>(
  function SeekableBunnyEmbed(props, ref) {
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
        buildEmbedUrl(props.libraryId, props.bunnyVideoId, props.config),
      );
      if (startSeconds > 0) {
        url.searchParams.set('t', String(startSeconds));
        url.searchParams.set('autoplay', 'true');
      }
      return url.toString();
    }, [props.libraryId, props.bunnyVideoId, props.config, startSeconds]);

    const ratio = aspectRatioCss(props.config.aspect_ratio);

    return (
      <div
        className={props.className ?? 'relative w-full'}
        style={{ aspectRatio: ratio }}
      >
        <iframe
          key={`${seekKey}:${embedUrl}`}
          src={embedUrl}
          title={props.title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  },
);
