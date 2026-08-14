'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { formatChapterTime } from '~/lib/videos/format';
import type { VideoChapter } from '~/lib/videos/types';

type Variant = 'public' | 'workspace';

const VARIANT_STYLES: Record<
  Variant,
  {
    panel: string;
    title: string;
    muted: string;
    link: string;
    border: string;
  }
> = {
  public: {
    panel:
      'rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white p-5',
    title: 'text-sm font-semibold text-[var(--ozer-plum-900)]',
    muted: 'text-sm text-[var(--ozer-text-muted)]',
    link: 'text-[var(--ozer-info)] hover:underline',
    border: 'border-[color:var(--ozer-border-on-light)]',
  },
  workspace: {
    panel:
      'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5',
    title: 'text-sm font-semibold text-[var(--workspace-shell-text)]',
    muted: 'text-sm text-[var(--workspace-shell-text-muted)]',
    link: 'text-[var(--ozer-accent)] hover:underline',
    border: 'border-[color:var(--workspace-shell-border)]',
  },
};

export function VideoChaptersList(props: {
  chapters: VideoChapter[];
  onSeek: (startMs: number) => void;
  variant?: Variant;
}) {
  const styles = VARIANT_STYLES[props.variant ?? 'public'];
  if (props.chapters.length === 0) return null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Chapters</h2>
      <ol className="mt-3 space-y-1">
        {props.chapters.map((chapter) => (
          <li key={chapter.id}>
            <button
              type="button"
              className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/5 ${styles.muted}`}
              onClick={() => props.onSeek(chapter.startMs)}
            >
              <span
                className={`shrink-0 font-mono text-xs tabular-nums ${styles.link}`}
              >
                {formatChapterTime(chapter.startMs)}
              </span>
              <span className={`text-sm ${styles.title}`}>{chapter.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function VideoTranscriptCard(props: {
  plainText: string | null;
  variant?: Variant;
}) {
  const styles = VARIANT_STYLES[props.variant ?? 'public'];
  const [expanded, setExpanded] = useState(false);
  const text = props.plainText?.trim() ?? '';
  if (!text) return null;

  return (
    <section className={styles.panel}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={styles.title}>Transcript</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.muted}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      <div
        className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${styles.muted} ${
          expanded ? '' : 'line-clamp-6'
        }`}
      >
        {text}
      </div>
    </section>
  );
}

export function VideoSummaryCard(props: {
  summary: string | null;
  variant?: Variant;
}) {
  const styles = VARIANT_STYLES[props.variant ?? 'public'];
  const text = props.summary?.trim() ?? '';
  if (!text) return null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Summary</h2>
      <p className={`mt-3 text-sm leading-relaxed ${styles.muted}`}>{text}</p>
    </section>
  );
}

export function VideoWatchMetaPanel(props: {
  chapters: VideoChapter[];
  transcriptPlainText: string | null;
  summary?: string | null;
  onSeek: (startMs: number) => void;
  variant?: Variant;
}) {
  const hasChapters = props.chapters.length > 0;
  const hasTranscript = Boolean(props.transcriptPlainText?.trim());
  const hasSummary = Boolean(props.summary?.trim());
  if (!hasChapters && !hasTranscript && !hasSummary) return null;

  return (
    <div className="mt-6 grid gap-4">
      <VideoSummaryCard
        summary={props.summary ?? null}
        variant={props.variant}
      />
      <VideoChaptersList
        chapters={props.chapters}
        onSeek={props.onSeek}
        variant={props.variant}
      />
      <VideoTranscriptCard
        plainText={props.transcriptPlainText}
        variant={props.variant}
      />
    </div>
  );
}
