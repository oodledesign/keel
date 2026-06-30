'use client';

import Link from 'next/link';

import { BookOpenCheck } from 'lucide-react';

import type { SopSuggestion } from '~/lib/planner/types';

type Props = {
  suggestions: SopSuggestion[];
};

export function SopSuggestionsStrip({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <aside className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text)]/35">
        <BookOpenCheck className="h-3.5 w-3.5" />
        Related SOPs
      </p>
      <ul className="mt-2 space-y-1.5">
        {suggestions.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="group flex items-baseline justify-between gap-3 text-sm text-[var(--workspace-shell-text)]/45 transition-colors hover:text-[var(--workspace-shell-text)]/65"
            >
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 text-[11px] text-[var(--workspace-shell-text)]/30 group-hover:text-[var(--workspace-shell-text)]/45">
                {item.reason}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
