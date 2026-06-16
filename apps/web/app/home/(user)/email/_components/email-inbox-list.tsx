'use client';

import { Loader2, Search, X } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import type { EmailInboxFilter, EmailThreadSummary } from '../_lib/types';

const panelClass =
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

function formatThreadDate(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function participantLabel(thread: EmailThreadSummary) {
  const first = thread.participants[0];
  if (!first) {
    return 'Unknown sender';
  }

  return first.name?.trim() || first.email;
}

function linkBadgeLabel(thread: EmailThreadSummary): string | null {
  if (thread.link.projectName) {
    return thread.link.projectName;
  }

  if (thread.link.clientName) {
    return thread.link.clientName;
  }

  return null;
}

type Props = {
  threads: EmailThreadSummary[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  filter: EmailInboxFilter;
  onFilterChange: (filter: EmailInboxFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searching?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
};

export function EmailInboxList({
  threads,
  selectedThreadId,
  onSelectThread,
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  searching = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
}: Props) {
  const trimmedSearch = searchQuery.trim();
  const needsReplyCount = threads.filter(
    (thread) => thread.assistant_category === 'needs_reply',
  ).length;
  const linkedCount = threads.filter((thread) => thread.link.linked).length;

  return (
    <section className={cn(panelClass, 'flex min-h-0 flex-col overflow-hidden')}>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Inbox</h2>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === 'all'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('linked')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === 'linked'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              Linked
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('needs_reply')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === 'needs_reply'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              Needs reply
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {searching
            ? 'Searching…'
            : threads.length === 0
              ? trimmedSearch
                ? `No threads match “${trimmedSearch}”`
                : filter === 'needs_reply'
                  ? 'No threads need a reply yet'
                  : filter === 'linked'
                    ? 'No linked threads yet'
                    : 'No threads yet'
              : trimmedSearch
                ? `${threads.length} result${threads.length === 1 ? '' : 's'} for “${trimmedSearch}”`
                : filter === 'linked'
                  ? `${threads.length} linked thread${threads.length === 1 ? '' : 's'}`
                  : filter === 'needs_reply'
                  ? `${threads.length} thread${threads.length === 1 ? '' : 's'} need a reply`
                  : `${threads.length} threads${needsReplyCount > 0 && filter === 'all' ? ` · ${needsReplyCount} need a reply` : ''}${linkedCount > 0 && filter === 'all' ? ` · ${linkedCount} linked` : ''}`}
        </p>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search subject, sender, or message…"
            className="border-white/10 bg-[#0B132B] pl-9 pr-9 text-sm text-white placeholder:text-zinc-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-500">
            {trimmedSearch
              ? 'Try a different search term or clear the search to see all threads.'
              : 'Connect Gmail and sync to see your recent inbox threads here.'}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {threads.map((thread) => {
              const selected = thread.id === selectedThreadId;

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]',
                      selected && 'bg-white/[0.05]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-2 h-2 w-2 shrink-0 rounded-full',
                        thread.is_unread
                          ? 'bg-[var(--keel-teal)]'
                          : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm',
                            thread.is_unread
                              ? 'font-semibold text-white'
                              : 'font-medium text-zinc-200',
                          )}
                        >
                          {participantLabel(thread)}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {formatThreadDate(thread.last_message_at)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block truncate text-sm',
                          thread.is_unread ? 'text-zinc-200' : 'text-zinc-400',
                        )}
                      >
                        {thread.subject?.trim() || '(no subject)'}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {thread.assistant_category === 'needs_reply' ? (
                          <span className="inline-flex rounded-full border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--keel-teal)]">
                            Needs reply
                          </span>
                        ) : null}
                        {linkBadgeLabel(thread) ? (
                          <span className="inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                            <span className="truncate">
                              {linkBadgeLabel(thread)}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {thread.snippet?.trim() || 'No preview'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasMore && onLoadMore ? (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.03] disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
