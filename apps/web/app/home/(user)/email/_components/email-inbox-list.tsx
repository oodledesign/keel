'use client';

import { Loader2 } from 'lucide-react';

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

type Props = {
  threads: EmailThreadSummary[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  filter: EmailInboxFilter;
  onFilterChange: (filter: EmailInboxFilter) => void;
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
  loadingMore = false,
  hasMore = false,
  onLoadMore,
}: Props) {
  const needsReplyCount = threads.filter(
    (thread) => thread.assistant_category === 'needs_reply',
  ).length;

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
          {threads.length === 0
            ? filter === 'needs_reply'
              ? 'No threads need a reply yet'
              : 'No threads yet'
            : filter === 'needs_reply'
              ? `${threads.length} thread${threads.length === 1 ? '' : 's'} need a reply`
              : `${threads.length} threads${needsReplyCount > 0 && filter === 'all' ? ` · ${needsReplyCount} need a reply` : ''}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-500">
            Connect Gmail and sync to see your recent inbox threads here.
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
                      {thread.assistant_category === 'needs_reply' ? (
                        <span className="mt-1 inline-flex rounded-full border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--keel-teal)]">
                          Needs reply
                        </span>
                      ) : null}
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
