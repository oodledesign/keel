'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import type { PortalChatMessage } from '../_lib/server/client-portal.service';
import { sendPortalMessage } from '../_lib/server/server-actions';
import { formatPortalDate } from './portal-badges';

export function PortalMessagesThread({
  clientOrgId,
  threadId,
  currentUserId,
  initialMessages,
}: {
  clientOrgId: string;
  threadId: string;
  currentUserId: string;
  initialMessages: PortalChatMessage[];
}) {
  const [messages, setMessages] =
    useState<PortalChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`portal-chat-thread-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            thread_id: string;
            sender_user_id: string;
            body: string;
            created_at: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    threadId: row.thread_id,
                    senderUserId: row.sender_user_id,
                    senderName: null,
                    body: row.body,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    // Fallback poll in case Realtime is unavailable in this environment.
    const interval = setInterval(async () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      const { data } = await supabase
        .from('chat_messages')
        .select('id, thread_id, sender_user_id, body, created_at')
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(200);

      if (!data) return;
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const row of data as Array<{
          id: string;
          thread_id: string;
          sender_user_id: string;
          body: string;
          created_at: string;
        }>) {
          if (!byId.has(row.id)) {
            byId.set(row.id, {
              id: row.id,
              threadId: row.thread_id,
              senderUserId: row.sender_user_id,
              senderName: null,
              body: row.body,
              createdAt: row.created_at,
            });
          }
        }
        return Array.from(byId.values()).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        );
      });
    }, 5000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [threadId]);

  function submit() {
    const body = draft.trim();
    if (!body) return;

    startTransition(async () => {
      try {
        const message = await sendPortalMessage({
          clientOrgId,
          threadId,
          body,
        });
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
        setDraft('');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not send message',
        );
      }
    });
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message) => {
            const isMine = message.senderUserId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                    isMine
                      ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                      : 'bg-[var(--workspace-shell-panel-hover)] text-[var(--ozer-text-on-light)]'
                  }`}
                >
                  {!isMine && message.senderName ? (
                    <p className="mb-0.5 text-xs font-medium opacity-80">
                      {message.senderName}
                    </p>
                  ) : null}
                  <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${isMine ? 'text-[var(--ozer-white)]/70' : 'text-[var(--ozer-text-on-light-muted)]'}`}
                  >
                    {formatPortalDate(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-[color:var(--workspace-shell-border)] p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="border-[color:var(--workspace-shell-border)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button onClick={submit} disabled={pending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
