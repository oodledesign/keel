'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Loader2, MoreHorizontal, Search, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  addEmailTriageRuleFromThreadAction,
  setEmailThreadCategoryAction,
} from '~/lib/email-assistant/email-assistant.actions';
import {
  EMAIL_THREAD_CATEGORIES,
  EMAIL_THREAD_CATEGORY_LABELS,
  type EmailThreadCategory,
  categoryFromTriageRuleAction,
  isActionableEmailCategory,
} from '~/lib/email-assistant/email-thread-categories';
import type {
  EmailTriageAction,
  EmailTriageScope,
} from '~/lib/email-assistant/email-triage-rules.shared';
import { triageRuleSuccessMessage } from '~/lib/email-assistant/email-triage-rules.shared';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';

import type {
  EmailInboxFilter,
  EmailThreadSummary,
  EmailWorkspaceOption,
} from '../_lib/types';
import { EmailCategoryBadge } from './email-category-badge';
import { EmailTriageRulesMenuItems } from './email-triage-rules-menu';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const FILTER_TABS: { value: EmailInboxFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Action' },
  { value: 'reply_later', label: 'Later' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'fyi', label: 'FYI' },
  { value: 'follow_up', label: 'Follow-up' },
];

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

function clientHref(
  thread: EmailThreadSummary,
  workspaces: EmailWorkspaceOption[],
): string | null {
  if (!thread.link.clientId || !thread.link.accountId) {
    return null;
  }

  const workspace = workspaces.find(
    (item) => item.id === thread.link.accountId,
  );

  if (!workspace?.slug) {
    return null;
  }

  return `${pathsConfig.app.accountClients.replace('[account]', workspace.slug)}/${thread.link.clientId}`;
}

function emptyFilterMessage(filter: EmailInboxFilter): string {
  switch (filter) {
    case 'action':
      return 'No threads need action yet';
    case 'reply_later':
      return 'No threads to reply later';
    case 'waiting':
      return 'No threads waiting on others';
    case 'fyi':
      return 'No FYI threads';
    case 'follow_up':
      return 'No follow-up reminders due';
    case 'linked':
      return 'No linked threads yet';
  }

  return 'No threads yet';
}

function listSummaryMessage(input: {
  filter: EmailInboxFilter;
  threads: EmailThreadSummary[];
  actionCount: number;
  followUpCount: number;
}): string {
  const { filter, threads, actionCount, followUpCount } = input;
  const count = threads.length;
  const plural = count === 1 ? '' : 's';

  switch (filter) {
    case 'action':
      return `${count} thread${plural} need action`;
    case 'reply_later':
      return `${count} thread${plural} to reply later`;
    case 'waiting':
      return `${count} thread${plural} waiting`;
    case 'fyi':
      return `${count} FYI thread${plural}`;
    case 'follow_up':
      return `${count} follow-up reminder${plural}`;
    case 'linked':
      return `${count} linked thread${plural}`;
    default:
      return `${count} thread${plural}${actionCount > 0 ? ` · ${actionCount} need action` : ''}${followUpCount > 0 ? ` · ${followUpCount} follow-up` : ''}`;
  }
}

type Props = {
  threads: EmailThreadSummary[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onThreadCategoryChange?: (
    threadId: string,
    category: EmailThreadCategory,
  ) => void;
  filter: EmailInboxFilter;
  onFilterChange: (filter: EmailInboxFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  workspaces?: EmailWorkspaceOption[];
  accountSlug?: string | null;
  searching?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
};

export function EmailInboxList({
  threads,
  selectedThreadId,
  onSelectThread,
  onThreadCategoryChange,
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  workspaces = [],
  accountSlug = null,
  searching = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
}: Props) {
  const [pending, startTransition] = useTransition();
  const trimmedSearch = searchQuery.trim();
  const actionCount = threads.filter((thread) =>
    isActionableEmailCategory(thread.assistant_category),
  ).length;
  const followUpCount = threads.filter((thread) =>
    Boolean(thread.follow_up_at),
  ).length;

  function setCategory(threadId: string, category: EmailThreadCategory) {
    startTransition(async () => {
      try {
        await setEmailThreadCategoryAction({
          threadId,
          category,
          accountSlug: accountSlug ?? undefined,
        });
        onThreadCategoryChange?.(threadId, category);
        toast.success(`Marked as ${EMAIL_THREAD_CATEGORY_LABELS[category]}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update category',
        );
      }
    });
  }

  function addTriageRule(
    threadId: string,
    action: EmailTriageAction,
    scope: EmailTriageScope,
  ) {
    startTransition(async () => {
      try {
        const result = await addEmailTriageRuleFromThreadAction({
          threadId,
          action,
          scope,
          accountSlug: accountSlug ?? undefined,
        });
        const category = categoryFromTriageRuleAction(action);
        onThreadCategoryChange?.(threadId, category);
        toast.success(
          triageRuleSuccessMessage(
            action,
            scope,
            result.value,
            result.affectedCount,
          ),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save triage rule',
        );
      }
    });
  }

  return (
    <section
      className={cn(
        panelClass,
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
      )}
    >
      <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Inbox
          </h2>
          <div className="-mx-1 max-w-full overflow-x-auto px-1">
            <div className="flex w-max rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onFilterChange(tab.value)}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                    filter === tab.value
                      ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                      : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          {searching
            ? 'Searching…'
            : threads.length === 0
              ? trimmedSearch
                ? `No threads match “${trimmedSearch}”`
                : emptyFilterMessage(filter)
              : trimmedSearch
                ? `${threads.length} result${threads.length === 1 ? '' : 's'} for “${trimmedSearch}”`
                : listSummaryMessage({
                    filter,
                    threads,
                    actionCount,
                    followUpCount,
                  })}
        </p>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search subject, sender, or message…"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] pr-9 pl-9 text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
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
              const href = clientHref(thread, workspaces);
              const badge = linkBadgeLabel(thread);
              const showUnlinked =
                isActionableEmailCategory(thread.assistant_category) &&
                !thread.link.clientId;

              return (
                <li
                  key={thread.id}
                  className={cn(
                    'group relative flex items-start gap-1 px-2 py-1 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
                    selected && 'bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-2 py-2 text-left"
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
                        <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
                          {formatEmailDateTime(thread.last_message_at)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block truncate text-sm',
                          thread.is_unread
                            ? 'text-[var(--workspace-shell-text)]'
                            : 'text-[var(--workspace-shell-text-muted)]',
                        )}
                      >
                        {thread.subject?.trim() || '(no subject)'}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <EmailCategoryBadge
                          category={thread.assistant_category}
                          confidence={thread.assistant_category_confidence}
                        />
                        {showUnlinked ? (
                          <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                            Unlinked
                          </span>
                        ) : null}
                        {badge && !href ? (
                          <span className="inline-flex max-w-full rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text-muted)]">
                            <span className="truncate">{badge}</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[var(--workspace-shell-text-muted)]">
                        {thread.snippet?.trim() || 'No preview'}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-start gap-1 pt-1.5 pr-1">
                    {href && badge ? (
                      <Link
                        href={href}
                        className="mt-0.5 hidden max-w-[7.5rem] truncate rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)]/35 sm:inline-flex"
                        title={`Open ${badge}`}
                      >
                        {badge}
                      </Link>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--workspace-shell-panel)] hover:text-[var(--workspace-shell-text)] focus-visible:opacity-100 data-[state=open]:opacity-100"
                          disabled={pending}
                          aria-label="Thread actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {EMAIL_THREAD_CATEGORIES.map((category) => (
                          <DropdownMenuItem
                            key={category}
                            disabled={
                              pending || thread.assistant_category === category
                            }
                            onSelect={() => setCategory(thread.id, category)}
                          >
                            Mark as {EMAIL_THREAD_CATEGORY_LABELS[category]}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <EmailTriageRulesMenuItems
                          subject={thread.subject}
                          disabled={pending}
                          onSelectRule={(action, scope) =>
                            addTriageRule(thread.id, action, scope)
                          }
                        />
                        {href ? (
                          <DropdownMenuItem asChild>
                            <Link href={href}>Open client</Link>
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
