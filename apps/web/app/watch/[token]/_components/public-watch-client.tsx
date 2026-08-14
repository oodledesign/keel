'use client';

import { useCallback, useRef } from 'react';

import { VideoWatchMetaPanel } from '~/components/videos/video-watch-meta-panel';
import { formatPublishedAt, formatViewCount } from '~/lib/videos/format';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';
import type { VideoChapter, VideoRow } from '~/lib/videos/types';

import {
  PublicTimelineWatchPlayer,
  type PublicTimelineWatchPlayerHandle,
} from './public-timeline-watch-player';
import {
  SeekableBunnyEmbed,
  type SeekableBunnyEmbedHandle,
} from './seekable-bunny-embed';

type Props = {
  video: VideoRow;
  config: VideoPlayerConfigValues;
  useTimelinePlayer: boolean;
  chapters: VideoChapter[];
  publishedAt: string | null;
  transcriptPlainText: string | null;
  summary: string | null;
  aspectRatio: string;
  embedReady: boolean;
};

export function PublicWatchClient(props: Props) {
  const timelineRef = useRef<PublicTimelineWatchPlayerHandle>(null);
  const bunnyRef = useRef<SeekableBunnyEmbedHandle>(null);
  const playerAnchorRef = useRef<HTMLDivElement>(null);

  const onSeek = useCallback(
    (ms: number) => {
      playerAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      if (props.useTimelinePlayer) {
        timelineRef.current?.seekToPlaybackMs(ms);
      } else {
        bunnyRef.current?.seekToPlaybackMs(ms);
      }
    },
    [props.useTimelinePlayer],
  );

  const publishedLabel = formatPublishedAt(props.publishedAt);

  return (
    <>
      <header className="mb-6 space-y-2">
        <p className="text-xs tracking-wide text-[var(--ozer-text-muted)] uppercase">
          Hosted video
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--ozer-plum-900)] sm:text-3xl">
          {props.video.title}
        </h1>
        <p className="text-sm text-[var(--ozer-text-muted)]">
          {formatViewCount(props.video.view_count)}{' '}
          {Number(props.video.view_count ?? 0) === 1 ? 'view' : 'views'}
          {publishedLabel ? (
            <>
              <span className="mx-2 text-[var(--ozer-text-muted)]/50">·</span>
              <time dateTime={props.publishedAt ?? undefined}>
                {publishedLabel}
              </time>
            </>
          ) : null}
        </p>
        {props.video.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--ozer-text-muted)]">
            {props.video.description}
          </p>
        ) : null}
      </header>

      <div
        ref={playerAnchorRef}
        className="mx-auto w-full overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-black shadow-lg shadow-[color:var(--ozer-plum-900)]/10"
        style={{ maxWidth: props.config.max_width_px ?? undefined }}
      >
        {props.useTimelinePlayer ? (
          <PublicTimelineWatchPlayer
            ref={timelineRef}
            token={props.video.public_share_token!}
            aspectRatio={props.aspectRatio}
          />
        ) : props.embedReady ? (
          <SeekableBunnyEmbed
            ref={bunnyRef}
            libraryId={props.video.bunny_library_id}
            bunnyVideoId={props.video.bunny_video_id}
            config={props.config}
            title={props.video.title}
          />
        ) : (
          <div
            className="relative flex w-full items-center justify-center bg-black/60"
            style={{ aspectRatio: props.aspectRatio }}
          >
            {props.video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.video.thumbnail_url}
                alt={props.video.title}
                className="absolute inset-0 h-full w-full object-cover opacity-40"
              />
            ) : null}
            <p className="relative z-10 px-6 text-center text-sm text-[var(--ozer-text-on-dark)]/80">
              {props.video.status === 'failed'
                ? 'This video failed to process.'
                : 'This video is still processing. Check back soon.'}
            </p>
          </div>
        )}
      </div>

      <VideoWatchMetaPanel
        chapters={props.chapters}
        transcriptPlainText={props.transcriptPlainText}
        summary={props.summary}
        onSeek={onSeek}
        variant="public"
      />
    </>
  );
}
