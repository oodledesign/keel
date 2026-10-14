'use client';

import { useEffect, useRef, useState } from 'react';

import { Check, Copy } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { copyTextToClipboard } from '~/lib/clipboard';
import { formatChapterTime } from '~/lib/videos/format';
import type { TranscriptSegment } from '~/lib/videos/transcript-segments';

const MANUAL_SCROLL_GRACE_MS = 4000;

export function PublicTranscriptPanel(props: {
  segments: TranscriptSegment[];
  plainText: string | null;
  /** Index of the segment playing now, or -1. */
  activeIndex: number;
  onSeek: (ms: number) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastManualScrollRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const active = props.activeIndex;

  useEffect(() => {
    const list = listRef.current;
    if (!list || active < 0) return;
    if (Date.now() - lastManualScrollRef.current < MANUAL_SCROLL_GRACE_MS) {
      return;
    }
    const item = list.querySelector<HTMLElement>(`[data-segment="${active}"]`);
    if (!item) return;
    const top = item.offsetTop - list.clientHeight / 3;
    list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [active]);

  const copyText =
    props.plainText?.trim() || props.segments.map((s) => s.text).join('\n\n');
  if (!copyText) return null;

  const markManualScroll = () => {
    lastManualScrollRef.current = Date.now();
  };

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white',
        props.className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ozer-border-on-light)] px-5 py-3">
        <h2 className="text-base font-semibold text-[var(--ozer-plum-900)]">
          Transcript
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            void copyTextToClipboard(copyText).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3"
        onWheel={markManualScroll}
        onTouchMove={markManualScroll}
      >
        {props.segments.length > 0 ? (
          <ol className="space-y-1">
            {props.segments.map((segment, i) => (
              <li key={`${segment.startMs}-${i}`} data-segment={i}>
                <button
                  type="button"
                  aria-current={i === active ? 'true' : undefined}
                  onClick={() => props.onSeek(segment.startMs)}
                  className={cn(
                    'flex w-full gap-3 rounded-lg px-2 py-2 text-left text-sm leading-relaxed text-[var(--ozer-plum-900)] transition-colors',
                    i === active
                      ? 'bg-[var(--ozer-accent-subtle)]'
                      : 'hover:bg-[var(--ozer-cream-100)]',
                  )}
                >
                  <span
                    className={cn(
                      'w-10 shrink-0 pt-px font-mono text-xs tabular-nums',
                      i === active
                        ? 'font-semibold text-[var(--ozer-accent-pressed)]'
                        : 'text-[var(--ozer-text-on-light-muted)]',
                    )}
                  >
                    {formatChapterTime(segment.startMs)}
                  </span>
                  <span>{segment.text}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-2 text-sm leading-relaxed whitespace-pre-wrap text-[var(--ozer-plum-900)]">
            {copyText}
          </p>
        )}
      </div>
    </section>
  );
}
