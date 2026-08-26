'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Keyboard, Loader2, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import { setEmailThreadCategoryAction } from '~/lib/email-assistant/email-assistant.actions';
import {
  type EmailThreadCategory,
  isActionableEmailCategory,
} from '~/lib/email-assistant/email-thread-categories';

import { emailApiFetch, formatEmailApiError } from '../_lib/email-api';
import type {
  EmailInboxFilter,
  EmailPageInitialData,
  EmailThreadSummary,
} from '../_lib/types';
import { EmailInboxList } from './email-inbox-list';
import { EmailOnboardingDialog } from './email-onboarding-dialog';
import { EmailSettingsCard } from './email-settings-card';
import { EmailThreadPanel } from './email-thread-panel';

const AUTO_SYNC_STALE_MS = 15 * 60 * 1000;
const MANUAL_SYNC_MAX_BATCHES = 8;

const INBOX_FILTERS: EmailInboxFilter[] = [
  'all',
  'action',
  'reply_later',
  'waiting',
  'fyi',
  'follow_up',
  'linked',
  'needs_reply',
];

function parseInboxFilter(value: string | null): EmailInboxFilter {
  if (value === 'needs_reply') {
    return 'action';
  }

  if (value && INBOX_FILTERS.includes(value as EmailInboxFilter)) {
    return value as EmailInboxFilter;
  }

  return 'all';
}

function threadMatchesFilter(
  thread: EmailThreadSummary,
  filter: EmailInboxFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'action') {
    return isActionableEmailCategory(thread.assistant_category);
  }

  if (filter === 'follow_up') {
    return Boolean(thread.follow_up_at);
  }

  if (filter === 'linked') {
    return thread.link.linked;
  }

  return thread.assistant_category === filter;
}

type SyncOptions = {
  mailOnly?: boolean;
  maxBatches?: number;
  quiet?: boolean;
};

type Props = {
  initialData: EmailPageInitialData;
};

function buildThreadsUrl(input: {
  filter: EmailInboxFilter;
  searchQuery?: string;
  cursor?: string | null;
  mailboxKind?: 'business' | 'personal';
  labelId?: string | null;
}) {
  const params = new URLSearchParams({ limit: '25' });
  params.set('mailbox', input.mailboxKind ?? 'personal');

  if (input.filter !== 'all') {
    params.set('filter', input.filter);
  }

  const trimmedSearch = input.searchQuery?.trim();

  if (trimmedSearch) {
    params.set('q', trimmedSearch);
  }

  if (input.labelId) {
    params.set('label', input.labelId);
  }

  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  return `/api/gmail/threads?${params.toString()}`;
}

export function EmailPageClient({ initialData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailboxKind = initialData.mailboxKind;
  const [threads, setThreads] = useState(initialData.threads);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData.threads.at(-1)?.last_message_at ?? null,
  );
  const [hasMore, setHasMore] = useState(initialData.hasMoreThreads);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmailOnboarding, setShowEmailOnboarding] = useState(
    Boolean(initialData.needsEmailOnboarding),
  );
  const [reviewMode, setReviewMode] = useState(false);
  const [syncing, startSyncTransition] = useTransition();
  const [, startCategoryTransition] = useTransition();
  const [inboxFilter, setInboxFilter] = useState<EmailInboxFilter>(() =>
    parseInboxFilter(searchParams.get('filter')),
  );
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRequestId = useRef(0);
  const skipInitialSearchFetch = useRef(true);
  const handledOAuthParams = useRef(false);
  const autoSyncStarted = useRef(false);

  const emailHomePath =
    mailboxKind === 'business' && initialData.accountSlug
      ? pathsConfig.app.accountEmailAssistant.replace(
          '[account]',
          initialData.accountSlug,
        )
      : pathsConfig.app.personalEmailAssistant;

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    () => searchParams.get('thread'),
  );
  const [focusDraft, setFocusDraft] = useState(
    () => searchParams.get('focus') === 'draft',
  );

  const syncThreadUrl = useCallback(
    (threadId: string | null, focus: boolean) => {
      const params = new URLSearchParams(window.location.search);

      if (threadId) {
        params.set('thread', threadId);
      } else {
        params.delete('thread');
        params.delete('focus');
      }

      if (focus && threadId) {
        params.set('focus', 'draft');
      } else {
        params.delete('focus');
      }

      const qs = params.toString();
      const url = qs ? `${emailHomePath}?${qs}` : emailHomePath;
      window.history.replaceState(null, '', url);
    },
    [emailHomePath],
  );

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setSelectedThreadId(params.get('thread'));
      setFocusDraft(params.get('focus') === 'draft');
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const threadsEndpoint = useCallback(
    (cursor?: string | null) =>
      buildThreadsUrl({
        filter: inboxFilter,
        searchQuery: debouncedSearch,
        cursor,
        mailboxKind,
        labelId: labelFilter,
      }),
    [inboxFilter, debouncedSearch, mailboxKind, labelFilter],
  );

  useEffect(() => {
    setThreads(initialData.threads);
    setNextCursor(initialData.threads.at(-1)?.last_message_at ?? null);
    setHasMore(initialData.hasMoreThreads);
  }, [initialData.threads]);

  const reloadThreads = useCallback(async () => {
    const data = await emailApiFetch<{
      threads: EmailThreadSummary[];
      nextCursor: string | null;
    }>(threadsEndpoint());

    setThreads(data.threads);
    setNextCursor(data.nextCursor);
    setHasMore(Boolean(data.nextCursor));
  }, [threadsEndpoint]);

  const runSync = useCallback(
    async (options: SyncOptions = {}) => {
      const mailOnly = options.mailOnly ?? false;
      const maxBatches = options.maxBatches ?? MANUAL_SYNC_MAX_BATCHES;
      const quiet = options.quiet ?? false;
      const syncParams = new URLSearchParams({ mailbox: mailboxKind });
      if (mailOnly) {
        syncParams.set('mode', 'mail');
      }
      if (initialData.preferredAccountId) {
        syncParams.set('preferredAccountId', initialData.preferredAccountId);
      }
      const syncUrl = `/api/gmail/sync?${syncParams.toString()}`;

      let totalProcessed = 0;
      let complete = true;
      let guard = 0;
      let draftsCreated = 0;
      let classified = 0;
      let linked = 0;
      let extracted = 0;

      do {
        const result = await emailApiFetch<{
          mode: string;
          messagesProcessed: number;
          backfillComplete?: boolean;
          remainingEstimate?: number;
          assistant?: {
            classified: number;
            linked?: number;
            draftsCreated: number;
            draftsSavedToGmail: number;
            extracted?: number;
            errors?: string[];
          } | null;
        }>(syncUrl, { method: 'POST' });

        totalProcessed += result.messagesProcessed;
        draftsCreated += result.assistant?.draftsCreated ?? 0;
        classified += result.assistant?.classified ?? 0;
        linked += result.assistant?.linked ?? 0;
        extracted += result.assistant?.extracted ?? 0;
        complete = mailOnly || result.backfillComplete !== false;
        guard += 1;
      } while (!complete && guard < maxBatches);

      await reloadThreads();
      router.refresh();

      if (quiet) {
        return;
      }

      if (extracted > 0) {
        toast.success(
          `Suggested ${extracted} email task${extracted === 1 ? '' : 's'} to review`,
        );
      } else if (draftsCreated > 0) {
        toast.success(
          `Drafted ${draftsCreated} repl${draftsCreated === 1 ? 'y' : 'ies'}`,
        );
      } else if (linked > 0) {
        toast.success(
          `Linked ${linked} thread${linked === 1 ? '' : 's'} to clients/projects`,
        );
      } else if (classified > 0) {
        toast.success(
          `Synced and sorted ${classified} thread${classified === 1 ? '' : 's'}`,
        );
      } else if (complete) {
        toast.success(
          totalProcessed > 0
            ? `Synced ${totalProcessed} message${totalProcessed === 1 ? '' : 's'}`
            : 'Mailbox is up to date',
        );
      } else {
        toast.success(
          `Synced ${totalProcessed} messages — still catching up, tap Sync again`,
        );
      }
    },
    [reloadThreads, router, mailboxKind, initialData.preferredAccountId],
  );

  useEffect(() => {
    const connected = searchParams.get('email_connected');
    const error = searchParams.get('email_error');

    if (!connected && !error) {
      return;
    }

    if (handledOAuthParams.current) {
      return;
    }

    handledOAuthParams.current = true;

    if (connected === '1') {
      toast.success('Gmail connected — syncing inbox…');
      setShowEmailOnboarding(true);
      router.replace(emailHomePath);

      startSyncTransition(async () => {
        try {
          await runSync();
        } catch (syncError) {
          toast.error(formatEmailApiError(syncError));
        }
      });
      return;
    }

    if (error) {
      toast.error(decodeURIComponent(error));
      router.replace(emailHomePath);
    }
  }, [router, searchParams, runSync, emailHomePath]);

  useEffect(() => {
    if (!initialData.connection || autoSyncStarted.current) {
      return;
    }

    const lastSyncedAt = initialData.settings.lastSyncedAt;
    if (lastSyncedAt) {
      const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
      if (ageMs < AUTO_SYNC_STALE_MS) {
        return;
      }
    }

    autoSyncStarted.current = true;

    startSyncTransition(async () => {
      try {
        // Always run full sync (mail + assistant) when the mailbox is stale so
        // triage / drafts / suggested tasks catch up even if Gmail had no new
        // messages since the last mail-only cron pass.
        const syncParams = new URLSearchParams({ mailbox: mailboxKind });
        if (initialData.preferredAccountId) {
          syncParams.set('preferredAccountId', initialData.preferredAccountId);
        }

        await emailApiFetch(`/api/gmail/sync?${syncParams.toString()}`, {
          method: 'POST',
        });

        await reloadThreads();
        router.refresh();
      } catch (syncError) {
        console.error(
          'Background email sync failed',
          formatEmailApiError(syncError),
          syncError,
        );
      }
    });
  }, [
    initialData.connection,
    initialData.settings.lastSyncedAt,
    initialData.preferredAccountId,
    mailboxKind,
    reloadThreads,
    router,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (skipInitialSearchFetch.current) {
      skipInitialSearchFetch.current = false;
      return;
    }

    const requestId = ++searchRequestId.current;
    setSearching(true);

    void emailApiFetch<{
      threads: EmailThreadSummary[];
      nextCursor: string | null;
    }>(
      buildThreadsUrl({
        filter: inboxFilter,
        searchQuery: debouncedSearch,
        mailboxKind,
        labelId: labelFilter,
      }),
    )
      .then((data) => {
        if (requestId !== searchRequestId.current) {
          return;
        }

        setThreads(data.threads);
        setNextCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      })
      .catch((error) => {
        if (requestId !== searchRequestId.current) {
          return;
        }

        toast.error(
          error instanceof Error ? formatEmailApiError(error) : 'Search failed',
        );
      })
      .finally(() => {
        if (requestId === searchRequestId.current) {
          setSearching(false);
        }
      });
  }, [debouncedSearch, inboxFilter, mailboxKind, labelFilter]);

  const selectThread = useCallback(
    (threadId: string) => {
      setSelectedThreadId(threadId);
      setFocusDraft(false);
      syncThreadUrl(threadId, false);
    },
    [syncThreadUrl],
  );

  const clearThread = useCallback(() => {
    setSelectedThreadId(null);
    setFocusDraft(false);
    syncThreadUrl(null, false);
  }, [syncThreadUrl]);

  const changeInboxFilter = useCallback((filter: EmailInboxFilter) => {
    setInboxFilter(filter);
  }, []);

  const handleThreadCategoryChange = useCallback(
    (threadId: string, category: EmailThreadCategory) => {
      setThreads((prev) =>
        prev
          .map((thread) =>
            thread.id === threadId
              ? { ...thread, assistant_category: category }
              : thread,
          )
          .filter((thread) => threadMatchesFilter(thread, inboxFilter)),
      );
    },
    [inboxFilter],
  );

  const categorizeSelectedThread = useCallback(
    (category: EmailThreadCategory) => {
      if (!selectedThreadId) {
        return;
      }

      startCategoryTransition(async () => {
        try {
          await setEmailThreadCategoryAction({
            threadId: selectedThreadId,
            category,
            accountSlug: initialData.accountSlug ?? undefined,
          });
          handleThreadCategoryChange(selectedThreadId, category);
          toast.success('Category updated');
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not update category',
          );
        }
      });
    },
    [
      selectedThreadId,
      initialData.accountSlug,
      handleThreadCategoryChange,
      startCategoryTransition,
    ],
  );

  const navigateThreads = useCallback(
    (direction: 1 | -1) => {
      if (threads.length === 0) {
        return;
      }

      const currentIndex = selectedThreadId
        ? threads.findIndex((thread) => thread.id === selectedThreadId)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : threads.length - 1
          : Math.min(threads.length - 1, Math.max(0, currentIndex + direction));
      const nextThread = threads[nextIndex];

      if (nextThread) {
        selectThread(nextThread.id);
      }
    },
    [threads, selectedThreadId, selectThread],
  );

  useEffect(() => {
    if (!reviewMode) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();

      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'j') {
        event.preventDefault();
        navigateThreads(1);
        return;
      }

      if (key === 'k') {
        event.preventDefault();
        navigateThreads(-1);
        return;
      }

      const categoryByKey: Record<string, EmailThreadCategory> = {
        r: 'reply_now',
        l: 'reply_later',
        w: 'waiting',
        f: 'fyi',
        n: 'noise',
      };

      const category = categoryByKey[key];

      if (category && selectedThreadId) {
        event.preventDefault();
        categorizeSelectedThread(category);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reviewMode, selectedThreadId, navigateThreads, categorizeSelectedThread]);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const syncNow = () => {
    startSyncTransition(async () => {
      try {
        await runSync();
      } catch (error) {
        toast.error(formatEmailApiError(error));
      }
    });
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const data = await emailApiFetch<{
        threads: EmailThreadSummary[];
        nextCursor: string | null;
      }>(threadsEndpoint(nextCursor));

      setThreads((current) => {
        const seen = new Set(current.map((thread) => thread.id));
        const appended = data.threads.filter((thread) => !seen.has(thread.id));
        return [...current, ...appended];
      });
      setNextCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? formatEmailApiError(error)
          : 'Could not load more',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const connected = Boolean(initialData.connection);
  const mobileShowThread = Boolean(selectedThreadId);

  return (
    <div
      className={cn(
        workspacePageMainClassName,
        'min-h-0 flex-1 overflow-hidden',
      )}
    >
      <div className="flex shrink-0 flex-col gap-4 border-b border-[color:var(--workspace-shell-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-3xl">
            {mailboxKind === 'business' ? 'Emails' : 'Personal email'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            {mailboxKind === 'business'
              ? 'Sync your business Gmail, auto-draft replies, and link threads to clients and projects.'
              : 'Connect a personal Gmail account for private mail — separate from your business inbox.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={reviewMode ? 'default' : 'outline'}
            className={cn(
              reviewMode
                ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
            )}
            onClick={() => setReviewMode((value) => !value)}
            disabled={!connected}
            title="Keyboard triage: J/K move threads · R reply now · L later · W waiting · F FYI · N noise"
          >
            <Keyboard className="mr-2 h-4 w-4" />
            {reviewMode ? 'Review mode on' : 'Review mode'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            onClick={() => setShowSettings((value) => !value)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            {showSettings ? 'Hide settings' : 'Settings'}
          </Button>
          <Button
            type="button"
            className="ozer-gradient-btn text-[var(--ozer-white)]"
            onClick={syncNow}
            disabled={!connected || syncing}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync now
              </>
            )}
          </Button>
        </div>
      </div>

      {showSettings ? (
        <div className="shrink-0">
          <EmailSettingsCard
            connectedEmail={initialData.connection?.googleEmail ?? null}
            mailboxKind={mailboxKind}
            returnPath={emailHomePath}
            initialStyleNotes={initialData.settings.styleNotes}
            initialSignature={initialData.settings.signature}
            initialSignatureIsHtml={initialData.settings.signatureIsHtml}
            initialAutoTriageEnabled={initialData.settings.autoTriageEnabled}
            initialAutoDraftEnabled={initialData.settings.autoDraftEnabled}
            initialAutoSaveGmailDrafts={
              initialData.settings.autoSaveGmailDrafts
            }
            initialAllowSendFromOzer={initialData.settings.allowSendFromOzer}
            initialSyncTriageToGmail={initialData.settings.syncTriageToGmail}
            initialRespectExistingGmailLabels={
              initialData.settings.respectExistingGmailLabels
            }
            onOpenEmailSetup={() => setShowEmailOnboarding(true)}
            initialIgnoredSenders={initialData.settings.ignoredSenders}
            initialIgnoredDomains={initialData.settings.ignoredDomains}
            initialIgnoredSubjectKeywords={
              initialData.settings.ignoredSubjectKeywords
            }
            initialPrioritySenders={initialData.settings.prioritySenders}
            initialPriorityDomains={initialData.settings.priorityDomains}
            initialPrioritySubjectKeywords={
              initialData.settings.prioritySubjectKeywords
            }
            lastSyncedAt={initialData.settings.lastSyncedAt}
          />
        </div>
      ) : null}

      <EmailOnboardingDialog
        open={showEmailOnboarding}
        onOpenChange={setShowEmailOnboarding}
        mailboxKind={mailboxKind}
        accountSlug={initialData.accountSlug}
        onCompleted={() => {
          setShowEmailOnboarding(false);
          router.refresh();
          startSyncTransition(async () => {
            try {
              await runSync();
            } catch (syncError) {
              toast.error(formatEmailApiError(syncError));
            }
          });
        }}
      />


      <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            mobileShowThread && 'hidden lg:flex',
          )}
        >
          <EmailInboxList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={selectThread}
            onThreadCategoryChange={handleThreadCategoryChange}
            filter={inboxFilter}
            onFilterChange={changeInboxFilter}
            gmailLabels={initialData.gmailLabels ?? []}
            labelFilter={labelFilter}
            onLabelFilterChange={setLabelFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            workspaces={initialData.workspaces}
            accountSlug={initialData.accountSlug}
            searching={searching}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            !mobileShowThread && 'hidden lg:flex',
          )}
        >
          <EmailThreadPanel
            threadId={selectedThreadId}
            connected={connected}
            workspaces={initialData.workspaces}
            gmailLabels={initialData.gmailLabels ?? []}
            mailboxKind={mailboxKind}
            accountSlug={initialData.accountSlug}
            preferredAccountId={initialData.preferredAccountId}
            reviewMode={reviewMode}
            allowSendFromOzer={initialData.settings.allowSendFromOzer}
            focusDraft={focusDraft}
            onBack={clearThread}
            showBackButton
            onCategoryChange={handleThreadCategoryChange}
          />
        </div>
      </div>
    </div>
  );
}
