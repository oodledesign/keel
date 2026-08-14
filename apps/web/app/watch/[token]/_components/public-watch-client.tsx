'use client';

import { useCallback, useRef } from 'react';

import {
  VideoChaptersList,
  VideoSummaryCard,
  VideoTranscriptCard,
} from '~/components/videos/video-watch-meta-panel';
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
  const hasSummary = Boolean(props.summary?.trim());
  const hasChapters = props.chapters.length > 0;
  const hasSideMeta = hasSummary || hasChapters;

  return (
    <>
      <header className="mb-6 space-y-2 lg:mb-8">
        <p className="text-sm font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
          Hosted video
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-plum-900)] sm:text-4xl">
          {props.video.title}
        </h1>
        <p className="text-base text-[var(--ozer-text-on-light-muted)]">
          {formatViewCount(props.video.view_count)}{' '}
          {Number(props.video.view_count ?? 0) === 1 ? 'view' : 'views'}
          {publishedLabel ? (
            <>
              <span className="mx-2 text-[var(--ozer-plum-900)]/25">·</span>
              <time dateTime={props.publishedAt ?? undefined}>
                {publishedLabel}
              </time>
            </>
          ) : null}
        </p>
        {props.video.description ? (
          <p className="max-w-4xl text-base leading-relaxed text-[var(--ozer-plum-900)]">
            {props.video.description}
          </p>
        ) : null}
      </header>

      <div
        className={
          hasSideMeta
            ? 'grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] lg:gap-8'
            : 'grid gap-5'
        }
      >
        {hasSideMeta ? (
          <aside className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
            <VideoSummaryCard summary={props.summary} variant="public" />
            <VideoChaptersList
              chapters={props.chapters}
              onSeek={onSeek}
              variant="public"
            />
          </aside>
        ) : null}

        <div
          ref={playerAnchorRef}
          className={`order-1 min-w-0 overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-black shadow-lg shadow-[color:var(--ozer-plum-900)]/10 lg:order-2 ${
            hasSideMeta ? '' : 'mx-auto w-full'
          }`}
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
              <p className="relative z-10 px-6 text-center text-base text-[var(--ozer-text-on-dark)]/80">
                {props.video.status === 'failed'
                  ? 'This video failed to process.'
                  : 'This video is still processing. Check back soon.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 lg:mt-8">
        <VideoTranscriptCard
          plainText={props.transcriptPlainText}
          variant="public"
        />
      </div>
    </>
  );
}
