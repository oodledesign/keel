'use client';

import { useCallback, useRef, useState } from 'react';

import { Download } from 'lucide-react';

import {
  VideoChaptersList,
  VideoSummaryCard,
} from '~/components/videos/video-watch-meta-panel';
import { formatPublishedAt, formatViewCount } from '~/lib/videos/format';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';
import {
  type TranscriptSegment,
  activeSegmentIndex,
} from '~/lib/videos/transcript-segments';
import type { VideoChapter, VideoRow } from '~/lib/videos/types';

import {
  PublicTimelineWatchPlayer,
  type PublicTimelineWatchPlayerHandle,
} from './public-timeline-watch-player';
import { PublicTranscriptPanel } from './public-transcript-panel';
import {
  SeekableBunnyEmbed,
  type SeekableBunnyEmbedHandle,
} from './seekable-bunny-embed';

type Props = {
  video: VideoRow;
  /** Authorised media endpoint for the timeline player. */
  mediaUrl: string;
  config: VideoPlayerConfigValues;
  useTimelinePlayer: boolean;
  streamMatchesPublishedEdit: boolean;
  chapters: VideoChapter[];
  publishedAt: string | null;
  transcriptPlainText: string | null;
  transcriptSegments: TranscriptSegment[];
  summary: string | null;
  aspectRatio: string;
  embedReady: boolean;
  /** Set when the owner allowed downloads and a current file exists. */
  downloadUrl?: string | null;
};

/** Widest the player can be while its full height still fits in the viewport. */
function viewportFitMaxWidth(aspectRatio: string): string {
  const [w, h] = aspectRatio.split('/').map(Number);
  if (!w || !h) return '100%';
  return `calc((100svh - 7rem) * ${w} / ${h})`;
}

export function PublicWatchClient(props: Props) {
  const timelineRef = useRef<PublicTimelineWatchPlayerHandle>(null);
  const bunnyRef = useRef<SeekableBunnyEmbedHandle>(null);
  const playerAnchorRef = useRef<HTMLDivElement>(null);
  const [masterUnsupported, setMasterUnsupported] = useState(false);
  const onMasterUnsupported = useCallback(() => setMasterUnsupported(true), []);
  const [activeSegment, setActiveSegment] = useState(-1);
  const segments = props.transcriptSegments;
  const onPlaybackTime = useCallback(
    (ms: number) => setActiveSegment(activeSegmentIndex(segments, ms)),
    [segments],
  );

  const playTimeline = props.useTimelinePlayer && !masterUnsupported;
  const timelineUnplayable =
    props.useTimelinePlayer &&
    masterUnsupported &&
    !props.streamMatchesPublishedEdit;

  const onSeek = useCallback(
    (ms: number) => {
      const anchor = playerAnchorRef.current;
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      onPlaybackTime(ms);
      if (playTimeline) {
        timelineRef.current?.seekToPlaybackMs(ms);
      } else {
        bunnyRef.current?.seekToPlaybackMs(ms);
      }
    },
    [playTimeline, onPlaybackTime],
  );

  const publishedLabel = formatPublishedAt(props.publishedAt);
  const hasSummary = Boolean(props.summary?.trim());
  const hasChapters = props.chapters.length > 0;
  const hasTranscript =
    props.transcriptSegments.length > 0 ||
    Boolean(props.transcriptPlainText?.trim());

  return (
    <>
      <header className="mb-6 space-y-2 lg:mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-plum-900)] sm:text-4xl">
            {props.video.title}
          </h1>
          {props.downloadUrl ? (
            <a
              href={props.downloadUrl}
              download
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--ozer-border-on-light)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--ozer-plum-900)] shadow-sm transition hover:shadow-md"
            >
              <Download className="size-4" aria-hidden />
              Download
            </a>
          ) : null}
        </div>
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
          hasTranscript
            ? 'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:gap-8'
            : 'grid gap-5'
        }
      >
        <div className="min-w-0 space-y-5 lg:space-y-8">
          <div
            ref={playerAnchorRef}
            className="mx-auto w-full min-w-0 overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-black shadow-lg shadow-[color:var(--ozer-plum-900)]/10"
            style={{ maxWidth: viewportFitMaxWidth(props.aspectRatio) }}
          >
            {playTimeline ? (
              <PublicTimelineWatchPlayer
                ref={timelineRef}
                mediaUrl={props.mediaUrl}
                aspectRatio={props.aspectRatio}
                config={props.config}
                onUnsupported={onMasterUnsupported}
                onPlaybackTime={onPlaybackTime}
              />
            ) : timelineUnplayable ? (
              <div
                className="flex w-full items-center justify-center bg-black/60 px-6 text-center text-base text-[var(--ozer-text-on-dark)]/80"
                style={{ aspectRatio: props.aspectRatio }}
              >
                This browser can&apos;t play this video yet. Try again shortly,
                or open it in Safari or Chrome.
              </div>
            ) : props.embedReady ? (
              <SeekableBunnyEmbed
                ref={bunnyRef}
                libraryId={props.video.bunny_library_id}
                bunnyVideoId={props.video.bunny_video_id}
                config={props.config}
                title={props.video.title}
                onPlaybackTime={onPlaybackTime}
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

          {hasSummary || hasChapters ? (
            <div
              className={
                hasSummary && hasChapters
                  ? 'grid items-start gap-5 xl:grid-cols-2 xl:gap-8'
                  : 'grid gap-5'
              }
            >
              <VideoSummaryCard summary={props.summary} variant="public" />
              <VideoChaptersList
                chapters={props.chapters}
                onSeek={onSeek}
                variant="public"
              />
            </div>
          ) : null}
        </div>

        {hasTranscript ? (
          <aside className="lg:sticky lg:top-6">
            <PublicTranscriptPanel
              segments={props.transcriptSegments}
              plainText={props.transcriptPlainText}
              activeIndex={activeSegment}
              onSeek={onSeek}
              className="h-[28rem] lg:h-[calc(100svh-3rem)]"
            />
          </aside>
        ) : null}
      </div>
    </>
  );
}
