'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Loader2, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';

import { emailApiFetch } from '../_lib/email-api';
import type {
  EmailInboxFilter,
  EmailPageInitialData,
  EmailThreadSummary,
} from '../_lib/types';
import { EmailInboxList } from './email-inbox-list';
import { EmailSettingsCard } from './email-settings-card';
import { EmailThreadPanel } from './email-thread-panel';

const AUTO_SYNC_STALE_MS = 15 * 60 * 1000;
const MANUAL_SYNC_MAX_BATCHES = 8;

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
}) {
  const params = new URLSearchParams({ limit: '25' });
  params.set('mailbox', input.mailboxKind ?? 'personal');

  if (input.filter === 'needs_reply') {
    params.set('filter', 'needs_reply');
  }

  if (input.filter === 'linked') {
    params.set('filter', 'linked');
  }

  const trimmedSearch = input.searchQuery?.trim();

  if (trimmedSearch) {
    params.set('q', trimmedSearch);
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
  const [syncing, startSyncTransition] = useTransition();
  const [inboxFilter, setInboxFilter] = useState<EmailInboxFilter>(() => {
    const filter = searchParams.get('filter');
    return filter === 'needs_reply' || filter === 'linked' ? filter : 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRequestId = useRef(0);
  const skipInitialSearchFetch = useRef(true);
  const handledOAuthParams = useRef(false);
  const autoSyncStarted = useRef(false);

  const selectedThreadId = searchParams.get('thread');

  const threadsEndpoint = useCallback(
    (cursor?: string | null) =>
      buildThreadsUrl({
        filter: inboxFilter,
        searchQuery: debouncedSearch,
        cursor,
        mailboxKind,
      }),
    [inboxFilter, debouncedSearch, mailboxKind],
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
            errors?: string[];
          } | null;
        }>(syncUrl, { method: 'POST' });

        totalProcessed += result.messagesProcessed;
        draftsCreated += result.assistant?.draftsCreated ?? 0;
        classified += result.assistant?.classified ?? 0;
        linked += result.assistant?.linked ?? 0;
        complete = mailOnly || result.backfillComplete !== false;
        guard += 1;
      } while (!complete && guard < maxBatches);

      await reloadThreads();
      router.refresh();

      if (quiet) {
        return;
      }

      if (draftsCreated > 0) {
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

  const emailHomePath =
    mailboxKind === 'business' && initialData.accountSlug
      ? pathsConfig.app.accountEmailAssistant.replace(
          '[account]',
          initialData.accountSlug,
        )
      : pathsConfig.app.personalEmailAssistant;

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
      router.replace(emailHomePath);

      startSyncTransition(async () => {
        try {
          await runSync();
        } catch (syncError) {
          toast.error(
            syncError instanceof Error ? syncError.message : 'Sync failed',
          );
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
        const mailResult = await emailApiFetch<{
          messagesProcessed: number;
        }>(`/api/gmail/sync?mode=mail&mailbox=${mailboxKind}`, {
          method: 'POST',
        });

        if (mailResult.messagesProcessed > 0) {
          await emailApiFetch(`/api/gmail/sync?mailbox=${mailboxKind}`, {
            method: 'POST',
          });
        }

        await reloadThreads();
        router.refresh();
      } catch (syncError) {
        console.error('Background email sync failed', syncError);
      }
    });
  }, [
    initialData.connection,
    initialData.settings.lastSyncedAt,
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

        toast.error(error instanceof Error ? error.message : 'Search failed');
      })
      .finally(() => {
        if (requestId === searchRequestId.current) {
          setSearching(false);
        }
      });
  }, [debouncedSearch, inboxFilter, mailboxKind]);

  const selectThread = useCallback(
    (threadId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('thread', threadId);
      router.push(`${emailHomePath}?${params.toString()}`);
    },
    [emailHomePath, router, searchParams],
  );

  const clearThread = useCallback(() => {
    router.push(emailHomePath);
  }, [emailHomePath, router]);

  const changeInboxFilter = useCallback((filter: EmailInboxFilter) => {
    setInboxFilter(filter);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const syncNow = () => {
    startSyncTransition(async () => {
      try {
        await runSync();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Sync failed');
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
        error instanceof Error ? error.message : 'Could not load more',
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
            lastSyncedAt={initialData.settings.lastSyncedAt}
          />
        </div>
      ) : null}

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
            filter={inboxFilter}
            onFilterChange={changeInboxFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
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
            onBack={clearThread}
            showBackButton
          />
        </div>
      </div>
    </div>
  );
}
