'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { MessageCircle, Plus } from 'lucide-react';

import { useTeamAccountWorkspace } from '@kit/team-accounts/hooks/use-team-account-workspace';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import type { MessageThreadListItem } from '../../messages/_lib/server/messages.service';
import { listMessageThreads } from '../../messages/_lib/server/server-actions';

export function ClientMessagesBlock({
  accountId,
  accountSlug,
  clientId,
}: {
  accountId: string;
  accountSlug: string;
  clientId: string;
}) {
  const workspace = useTeamAccountWorkspace();
  const userId = workspace.user.id;
  const [threads, setThreads] = useState<MessageThreadListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMessageThreads({
      accountId,
      userId,
      clientId,
      limit: 20,
    })
      .then((rows) => {
        if (!cancelled) setThreads(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, userId, clientId]);

  const inboxHref = pathsConfig.app.accountMessages.replace(
    '[account]',
    accountSlug,
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Messages
          </h3>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Threads linked to this client that you participate in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${inboxHref}?client=${clientId}&compose=direct`}>
              Direct
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)]"
          >
            <Link href={`${inboxHref}?client=${clientId}&compose=client`}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Whole client
            </Link>
          </Button>
        </div>
      </div>

      {threads === null ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading conversations…
        </p>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center">
          <MessageCircle className="mx-auto h-5 w-5 text-[var(--workspace-shell-text-muted)]" />
          <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
            No chats yet. Start a direct message or a whole-client thread.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`${inboxHref}?thread=${thread.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {thread.title?.trim() ||
                      thread.participants
                        .map((p) => p.display_name)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(', ') ||
                      'Conversation'}
                  </p>
                  <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {thread.last_message_preview ?? 'No messages yet'}
                  </p>
                </div>
                {thread.unread_count > 0 ? (
                  <span className="rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-[11px] text-[var(--ozer-white)]">
                    {thread.unread_count}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
