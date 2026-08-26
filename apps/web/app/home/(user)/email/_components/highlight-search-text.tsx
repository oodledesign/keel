'use client';

import type { ReactNode } from 'react';

import { cn } from '@kit/ui/utils';

type Props = {
  text: string;
  query: string;
  className?: string;
};

/** Case-insensitive highlight for a single contiguous search phrase. */
export function HighlightSearchText({ text, query, className }: Props) {
  const trimmed = query.trim();

  if (!trimmed || !text) {
    return <span className={className}>{text}</span>;
  }

  const haystack = text.toLowerCase();
  const needle = trimmed.toLowerCase();

  if (needle.length === 0 || !haystack.includes(needle)) {
    return <span className={className}>{text}</span>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  let from = 0;
  let key = 0;

  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(
      <mark
        key={key++}
        className={cn(
          'rounded-sm bg-[var(--ozer-accent)]/25 px-0.5 text-inherit',
        )}
      >
        {text.slice(index, index + needle.length)}
      </mark>,
    );

    cursor = index + needle.length;
    from = cursor;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
}
