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

type Props = {
  initialData: EmailPageInitialData;
};

function buildThreadsUrl(input: {
  filter: EmailInboxFilter;
  searchQuery?: string;
  cursor?: string | null;
}) {
  const params = new URLSearchParams({ limit: '25' });

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
  const [threads, setThreads] = useState(initialData.threads);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData.threads.at(-1)?.last_message_at ?? null,
  );
  const [hasMore, setHasMore] = useState(initialData.threads.length >= 25);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, startSyncTransition] = useTransition();
  const [inboxFilter, setInboxFilter] = useState<EmailInboxFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRequestId = useRef(0);
  const skipInitialSearchFetch = useRef(true);

  const selectedThreadId = searchParams.get('thread');

  const threadsEndpoint = useCallback(
    (cursor?: string | null) =>
      buildThreadsUrl({
        filter: inboxFilter,
        searchQuery: debouncedSearch,
        cursor,
      }),
    [inboxFilter, debouncedSearch],
  );

  useEffect(() => {
    setThreads(initialData.threads);
    setNextCursor(initialData.threads.at(-1)?.last_message_at ?? null);
    setHasMore(initialData.threads.length >= 25);
  }, [initialData.threads]);

  useEffect(() => {
    const connected = searchParams.get('email_connected');
    const error = searchParams.get('email_error');

    if (connected === '1') {
      toast.success('Gmail connected');
      router.replace(pathsConfig.app.personalEmailAssistant);
    } else if (error) {
      toast.error(decodeURIComponent(error));
      router.replace(pathsConfig.app.personalEmailAssistant);
    }
  }, [router, searchParams]);

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
    }>(buildThreadsUrl({ filter: inboxFilter, searchQuery: debouncedSearch }))
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
  }, [debouncedSearch, inboxFilter]);

  const selectThread = useCallback(
    (threadId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('thread', threadId);
      router.push(
        `${pathsConfig.app.personalEmailAssistant}?${params.toString()}`,
      );
    },
    [router, searchParams],
  );

  const clearThread = useCallback(() => {
    router.push(pathsConfig.app.personalEmailAssistant);
  }, [router]);

  const reloadThreads = useCallback(async () => {
    const data = await emailApiFetch<{
      threads: EmailThreadSummary[];
      nextCursor: string | null;
    }>(threadsEndpoint());

    setThreads(data.threads);
    setNextCursor(data.nextCursor);
    setHasMore(Boolean(data.nextCursor));
  }, [threadsEndpoint]);

  const changeInboxFilter = useCallback((filter: EmailInboxFilter) => {
    setInboxFilter(filter);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const syncNow = () => {
    startSyncTransition(async () => {
      try {
        let totalProcessed = 0;
        let complete = true;
        let guard = 0;
        let draftsCreated = 0;
        let classified = 0;
        let linked = 0;
        const maxBatches = 25;

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
          }>('/api/gmail/sync', { method: 'POST' });

          totalProcessed += result.messagesProcessed;
          draftsCreated += result.assistant?.draftsCreated ?? 0;
          classified += result.assistant?.classified ?? 0;
          linked += result.assistant?.linked ?? 0;
          complete = result.backfillComplete !== false;
          guard += 1;
        } while (!complete && guard < maxBatches);

        await reloadThreads();
        router.refresh();

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
    <div className={cn(workspacePageMainClassName, 'min-h-0')}>
      <div className="flex flex-col gap-4 border-b border-[color:var(--workspace-shell-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-3xl">
            Email
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            Sync Gmail threads, auto-draft replies that need a response, and
            save them back to Gmail.
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
        <EmailSettingsCard
          connectedEmail={initialData.connection?.googleEmail ?? null}
          initialStyleNotes={initialData.settings.styleNotes}
          initialSignature={initialData.settings.signature}
          initialSignatureIsHtml={initialData.settings.signatureIsHtml}
          initialAutoTriageEnabled={initialData.settings.autoTriageEnabled}
          initialAutoDraftEnabled={initialData.settings.autoDraftEnabled}
          initialAutoSaveGmailDrafts={initialData.settings.autoSaveGmailDrafts}
          lastSyncedAt={initialData.settings.lastSyncedAt}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
        <div className={cn(mobileShowThread && 'hidden lg:block')}>
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

        <div className={cn(!mobileShowThread && 'hidden lg:block')}>
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
