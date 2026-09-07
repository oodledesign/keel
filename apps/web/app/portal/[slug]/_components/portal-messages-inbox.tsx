'use client';

import { useMemo, useState } from 'react';

import { cn } from '@kit/ui/utils';

import type {
  PortalChatMessage,
  PortalChatThread,
} from '../_lib/server/client-portal.service';
import { PortalMessagesThread } from './portal-messages-thread';

export function PortalMessagesInbox({
  clientOrgId,
  currentUserId,
  threads,
  initialThreadId,
  initialMessages,
}: {
  clientOrgId: string;
  currentUserId: string;
  threads: PortalChatThread[];
  initialThreadId: string | null;
  initialMessages: PortalChatMessage[];
}) {
  const [selectedId, setSelectedId] = useState(
    initialThreadId ?? threads[0]?.id ?? null,
  );

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? null,
    [threads, selectedId],
  );

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[var(--ozer-text-on-light)]">
          No conversations yet
        </p>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          When the team starts a chat with you, it will show up here. Only
          people added to that conversation can see it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] md:flex-row">
      <aside className="w-full shrink-0 border-b border-[color:var(--workspace-shell-border)] md:w-72 md:border-r md:border-b-0">
        <ul>
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setSelectedId(thread.id)}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 text-left',
                  selectedId === thread.id
                    ? 'bg-[var(--workspace-shell-panel-hover)]'
                    : 'hover:bg-[var(--workspace-shell-panel-hover)]',
                )}
              >
                <span className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                  {thread.title}
                </span>
                <span className="truncate text-xs text-[var(--ozer-text-on-light-muted)]">
                  {thread.lastMessagePreview ?? 'No messages yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1">
        {selected ? (
          <PortalMessagesThread
            key={selected.id}
            clientOrgId={clientOrgId}
            threadId={selected.id}
            currentUserId={currentUserId}
            initialMessages={
              selected.id === initialThreadId ? initialMessages : []
            }
          />
        ) : null}
      </div>
    </div>
  );
}
