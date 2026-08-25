'use client';

import type { ReactNode } from 'react';

import { cn } from '@kit/ui/utils';

export type TextMatch = {
  start: number;
  end: number;
};

export function findTextMatches(text: string, query: string): TextMatch[] {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return [];
  }

  const haystack = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const matches: TextMatch[] = [];
  let from = 0;

  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    matches.push({ start: index, end: index + needle.length });
    from = index + Math.max(needle.length, 1);
  }

  return matches;
}

export function countSegmentMatches(
  segments: Array<{ text: string }>,
  query: string,
): number {
  return segments.reduce(
    (total, segment) => total + findTextMatches(segment.text, query).length,
    0,
  );
}

type HighlightedTextProps = {
  text: string;
  query: string;
  /** Absolute match index offset for this text block within the full transcript. */
  matchOffset: number;
  activeMatchIndex: number;
  className?: string;
};

export function HighlightedText({
  text,
  query,
  matchOffset,
  activeMatchIndex,
  className,
}: HighlightedTextProps) {
  const matches = findTextMatches(text, query);

  if (matches.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, localIndex) => {
    if (match.start > cursor) {
      parts.push(text.slice(cursor, match.start));
    }

    const globalIndex = matchOffset + localIndex;
    const isActive = globalIndex === activeMatchIndex;

    parts.push(
      <mark
        key={`${match.start}-${match.end}`}
        data-transcript-match={globalIndex}
        className={cn(
          'rounded-sm px-0.5',
          isActive
            ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
            : 'bg-[var(--ozer-accent)]/25 text-[var(--workspace-shell-text)]',
        )}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
}
