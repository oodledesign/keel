'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { ImagePlus, X } from 'lucide-react';

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
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
            image_url: string | null;
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
                    imageUrl: row.image_url,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    const interval = setInterval(async () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      const { data } = await supabase
        .from('chat_messages')
        .select('id, thread_id, sender_user_id, body, image_url, created_at')
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
          image_url: string | null;
          created_at: string;
        }>) {
          if (!byId.has(row.id)) {
            byId.set(row.id, {
              id: row.id,
              threadId: row.thread_id,
              senderUserId: row.sender_user_id,
              senderName: null,
              body: row.body,
              imageUrl: row.image_url,
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

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingImage(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('accountId', clientOrgId);
    formData.append('accountSlug', clientOrgId);
    formData.append('threadId', threadId);
    formData.append('file', file);
    const response = await fetch('/api/messages/upload-image', {
      method: 'POST',
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      imageUrl?: string;
      error?: string;
    };
    if (!response.ok || !payload.imageUrl) {
      throw new Error(payload.error ?? 'Failed to upload image');
    }
    return payload.imageUrl;
  }

  function submit() {
    const body = draft.trim();
    const file = pendingImage;
    if (!body && !file) return;

    startTransition(async () => {
      try {
        let imageUrl: string | undefined;
        if (file) {
          imageUrl = await uploadImage(file);
        }
        const message = await sendPortalMessage({
          clientOrgId,
          threadId,
          body,
          imageUrl,
        });
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
        setDraft('');
        clearImage();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not send message',
        );
      }
    });
  }

  return (
    <div className="flex h-[60vh] flex-col">
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
                  {message.imageUrl ? (
                    <a
                      href={message.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-2 block overflow-hidden rounded-lg"
                    >
                      <img
                        src={message.imageUrl}
                        alt=""
                        className="max-h-56 w-full object-cover"
                      />
                    </a>
                  ) : null}
                  {message.body ? (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.body}
                    </p>
                  ) : null}
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

      <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] p-3">
        {previewUrl ? (
          <div className="flex items-center gap-2">
            <img
              src={previewUrl}
              alt=""
              className="h-12 w-12 rounded-md object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="text-[var(--ozer-text-on-light-muted)]"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPendingImage(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
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
          <Button
            onClick={submit}
            disabled={pending || (!draft.trim() && !pendingImage)}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
