'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  /** Playback milliseconds as the video plays. */
  onPlaybackTime?: (ms: number) => void;
};

const PLAYER_JS = { context: 'player.js', version: '0.0.11' } as const;

type PlayerJsMessage = {
  context?: string;
  event?: string;
  value?: unknown;
};

function parsePlayerJsMessage(data: unknown): PlayerJsMessage | null {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as PlayerJsMessage;
  return message.context === PLAYER_JS.context ? message : null;
}

function readSeconds(value: unknown): number | null {
  const data =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;
  if (!data || typeof data !== 'object') return null;
  const seconds = Number((data as { seconds?: unknown }).seconds);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Bunny iframe wrapper. Talks player.js to report playback time and seek in
 * place; until the player is ready, seeks remount with `t` (start seconds).
 */
export const SeekableBunnyEmbed = forwardRef<SeekableBunnyEmbedHandle, Props>(
  function SeekableBunnyEmbed(props, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerReadyRef = useRef(false);
    const [startSeconds, setStartSeconds] = useState(0);
    const [seekKey, setSeekKey] = useState(0);
    const onPlaybackTime = props.onPlaybackTime;

    const send = useCallback((method: string, value?: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ ...PLAYER_JS, method, value }),
        '*',
      );
    }, []);

    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const message = parsePlayerJsMessage(event.data);
        if (!message) return;
        if (message.event === 'ready') {
          playerReadyRef.current = true;
          send('addEventListener', 'timeupdate');
          return;
        }
        if (message.event === 'timeupdate') {
          const seconds = readSeconds(message.value);
          if (seconds !== null) onPlaybackTime?.(seconds * 1000);
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }, [onPlaybackTime, send]);

    useImperativeHandle(
      ref,
      () => ({
        seekToPlaybackMs: (ms: number) => {
          const seconds = Math.max(0, ms / 1000);
          if (playerReadyRef.current) {
            send('setCurrentTime', seconds);
            send('play');
            onPlaybackTime?.(seconds * 1000);
            return;
          }
          playerReadyRef.current = false;
          setStartSeconds(Math.floor(seconds));
          setSeekKey((k) => k + 1);
        },
      }),
      [onPlaybackTime, send],
    );

    const embedUrl = useMemo(() => {
      const url = new URL(
        buildEmbedUrl(props.libraryId, props.bunnyVideoId, props.config),
      );
      if (startSeconds > 0) {
        url.searchParams.set('t', String(startSeconds));
      }
      if (seekKey > 0) {
        url.searchParams.set('autoplay', 'true');
      }
      return url.toString();
    }, [
      props.libraryId,
      props.bunnyVideoId,
      props.config,
      startSeconds,
      seekKey,
    ]);

    const ratio = aspectRatioCss(props.config.aspect_ratio);

    return (
      <div
        className={props.className ?? 'relative w-full'}
        style={{ aspectRatio: ratio }}
      >
        <iframe
          ref={iframeRef}
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
