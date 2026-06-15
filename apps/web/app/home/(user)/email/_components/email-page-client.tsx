'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Loader2, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { emailApiFetch } from '../_lib/email-api';
import type { EmailPageInitialData, EmailThreadSummary } from '../_lib/types';
import { EmailInboxList } from './email-inbox-list';
import { EmailSettingsCard } from './email-settings-card';
import { EmailThreadPanel } from './email-thread-panel';

type Props = {
  initialData: EmailPageInitialData;
};

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

  const selectedThreadId = searchParams.get('thread');

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

  const selectThread = useCallback(
    (threadId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('thread', threadId);
      router.push(`${pathsConfig.app.personalEmailAssistant}?${params.toString()}`);
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
    }>('/api/gmail/threads?limit=25');

    setThreads(data.threads);
    setNextCursor(data.nextCursor);
    setHasMore(Boolean(data.nextCursor));
  }, []);

  const syncNow = () => {
    startSyncTransition(async () => {
      try {
        let totalProcessed = 0;
        let complete = true;
        let guard = 0;
        const maxBatches = 25;

        do {
          const result = await emailApiFetch<{
            mode: string;
            messagesProcessed: number;
            backfillComplete?: boolean;
            remainingEstimate?: number;
          }>('/api/gmail/sync', { method: 'POST' });

          totalProcessed += result.messagesProcessed;
          complete = result.backfillComplete !== false;
          guard += 1;
        } while (!complete && guard < maxBatches);

        await reloadThreads();
        router.refresh();

        if (complete) {
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
      }>(
        `/api/gmail/threads?limit=25&cursor=${encodeURIComponent(nextCursor)}`,
      );

      setThreads((current) => {
        const seen = new Set(current.map((thread) => thread.id));
        const appended = data.threads.filter((thread) => !seen.has(thread.id));
        return [...current, ...appended];
      });
      setNextCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const connected = Boolean(initialData.connection);
  const mobileShowThread = Boolean(selectedThreadId);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-3 pb-8 pt-3 md:px-6 md:pb-12 md:pt-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Email
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Sync Gmail threads, turn messages into tasks, and draft replies you
            save back to Gmail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-[var(--workspace-shell-panel)] text-white hover:bg-white/5"
            onClick={() => setShowSettings((value) => !value)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            {showSettings ? 'Hide settings' : 'Settings'}
          </Button>
          <Button
            type="button"
            className="keel-gradient-btn text-white"
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
          lastSyncedAt={initialData.settings.lastSyncedAt}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
        <div className={cn(mobileShowThread && 'hidden lg:block')}>
          <EmailInboxList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={selectThread}
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
