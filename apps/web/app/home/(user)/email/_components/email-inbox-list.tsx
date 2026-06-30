'use client';

import { Loader2, Search, X } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import type { EmailInboxFilter, EmailThreadSummary } from '../_lib/types';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

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
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Inbox</h2>
          <div className="flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === 'all'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
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
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
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
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              Needs reply
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search subject, sender, or message…"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] pl-9 pr-9 text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="px-4 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
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
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
                      selected && 'bg-[var(--workspace-shell-sidebar-accent)]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-2 h-2 w-2 shrink-0 rounded-full',
                        thread.is_unread
                          ? 'bg-[var(--ozer-accent)]'
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
                              ? 'font-semibold text-[var(--workspace-shell-text)]'
                              : 'font-medium text-[var(--workspace-shell-text)]',
                          )}
                        >
                          {participantLabel(thread)}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                          {formatThreadDate(thread.last_message_at)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block truncate text-sm',
                          thread.is_unread ? 'text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)]',
                        )}
                      >
                        {thread.subject?.trim() || '(no subject)'}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {thread.assistant_category === 'needs_reply' ? (
                          <span className="inline-flex rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ozer-accent)]">
                            Needs reply
                          </span>
                        ) : null}
                        {linkBadgeLabel(thread) ? (
                          <span className="inline-flex max-w-full rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text-muted)]">
                            <span className="truncate">
                              {linkBadgeLabel(thread)}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[var(--workspace-shell-text-muted)]">
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
        <div className="border-t border-[color:var(--workspace-shell-border)] p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] disabled:opacity-60"
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
