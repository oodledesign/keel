'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Loader2, MessageSquarePlus, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  createBrainThread,
  listBrainThreadMessages,
  listBrainThreads,
} from '../_lib/server/brain-actions';
import { BrainSourcePreviewDrawer } from './brain-source-preview-drawer';

type ThreadRow = {
  id: string;
  title: string | null;
  scope: Record<string, unknown>;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context_refs?: Array<{
    source_type: string;
    source_id: string;
    title: string;
    url?: string;
    score: number;
    chunk_text?: string;
  }>;
};

type BrainScope = {
  jobId?: string;
  clientId?: string;
  jobTitle?: string;
  clientName?: string;
};

function parseRefsFromStream(text: string) {
  const marker = '[[BRAIN_REFS:';
  const start = text.indexOf(marker);
  if (start < 0) return { content: text, refs: [] as MessageRow['context_refs'] };
  const end = text.indexOf(']]', start);
  if (end < 0) return { content: text.slice(0, start).trim(), refs: [] };
  const json = text.slice(start + marker.length, end);
  try {
    return {
      content: text.slice(0, start).trim(),
      refs: JSON.parse(json) as MessageRow['context_refs'],
    };
  } catch {
    return { content: text.slice(0, start).trim(), refs: [] };
  }
}

export function BrainChatContent({
  accountId,
  accountSlug,
  voyageConfigured,
  initialScope,
  starterQuestion,
}: {
  accountId: string;
  accountSlug: string;
  voyageConfigured: boolean;
  initialScope?: BrainScope;
  starterQuestion?: string;
}) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState(starterQuestion ?? '');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searching, setSearching] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [previewRef, setPreviewRef] = useState<{
    source_type: string;
    source_id: string;
    title: string;
    url?: string;
    score: number;
    chunkText?: string;
  } | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const scope = initialScope;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) =>
      (thread.title ?? 'New chat').toLowerCase().includes(q),
    );
  }, [threadSearch, threads]);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const rows = (await listBrainThreads({ accountId, accountSlug })) as ThreadRow[];
      setThreads(rows);
      if (!threadId && rows[0]) setThreadId(rows[0].id);
    } catch {
      toast.error('Could not load chats');
    } finally {
      setLoadingThreads(false);
    }
  }, [accountId, accountSlug, threadId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    void listBrainThreadMessages({ accountId, accountSlug, threadId })
      .then((rows) => setMessages(rows as MessageRow[]))
      .catch(() => toast.error('Could not load messages'))
      .finally(() => setLoadingMessages(false));
  }, [accountId, accountSlug, threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const handleNewThread = async () => {
    try {
      const thread = (await createBrainThread({
        accountId,
        accountSlug,
        scope,
      })) as ThreadRow;
      setThreads((prev) => [thread, ...prev]);
      setThreadId(thread.id);
      setMessages([]);
      setMobileShowChat(true);
    } catch {
      toast.error('Could not create chat');
    }
  };

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message || streaming) return;

    if (!voyageConfigured) {
      toast.error('Add VOYAGE_API_KEY to enable the knowledge base');
      return;
    }

    let activeThreadId = threadId;
    if (!activeThreadId) {
      const thread = (await createBrainThread({
        accountId,
        accountSlug,
        scope,
      })) as ThreadRow;
      activeThreadId = thread.id;
      setThreadId(thread.id);
      setThreads((prev) => [thread, ...prev]);
    }

    setDraft('');
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: message },
    ]);
    setSearching(true);
    setStreaming(true);

    try {
      const res = await fetch('/api/brain/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accountSlug,
          threadId: activeThreadId,
          message,
          scope,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      setSearching(false);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamed = '';

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: '' },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamed += decoder.decode(value, { stream: true });
        const visible = parseRefsFromStream(streamed).content;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: visible };
          }
          return next;
        });
      }

      const parsed = parseRefsFromStream(streamed);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: parsed.content,
            context_refs: parsed.refs,
          };
        }
        return next;
      });

      void loadThreads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setSearching(false);
      setStreaming(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      {!voyageConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 lg:col-span-2">
          Set <code className="text-amber-50">VOYAGE_API_KEY</code> to index your
          workspace and enable semantic search. Anthropic powers replies; Voyage
          powers embeddings.
        </div>
      )}

      <aside
        className={`w-full shrink-0 space-y-3 lg:w-72 ${
          mobileShowChat ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Chats</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-zinc-600"
            onClick={handleNewThread}
          >
            <MessageSquarePlus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>
        <Input
          value={threadSearch}
          onChange={(e) => setThreadSearch(e.target.value)}
          placeholder="Search chats…"
          className="border-zinc-600 bg-zinc-900 text-white"
        />
        <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900/40 p-2 lg:max-h-[60vh]">
          {loadingThreads ? (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </li>
          ) : filteredThreads.length === 0 ? (
            <li className="px-2 py-3 text-sm text-zinc-500">No chats yet</li>
          ) : (
            filteredThreads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    setThreadId(thread.id);
                    setMobileShowChat(true);
                  }}
                  className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                    threadId === thread.id
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {thread.title?.trim() || 'New chat'}
                </button>
              </li>
            ))
          )}
        </ul>
        {scope?.jobTitle && (
          <p className="text-xs text-zinc-500">
            Scoped to job: {scope.jobTitle}
          </p>
        )}
      </aside>

      <section
        className={`flex min-h-[60vh] flex-1 flex-col rounded-xl border border-zinc-700 bg-[var(--workspace-shell-panel)] ${
          mobileShowChat ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-zinc-700 px-4 py-2 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-300"
            onClick={() => setMobileShowChat(false)}
          >
            ← Chats
          </Button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loadingMessages ? (
            <p className="text-sm text-zinc-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <Sparkles className="h-8 w-8 text-[var(--keel-teal)]" />
              <p className="max-w-md text-sm text-zinc-400">
                Ask anything about your notes, docs, jobs, transcripts, and
                proposals. Answers include citations back to your Keel records.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-8 bg-[var(--keel-teal)]/15 text-white'
                    : 'mr-8 bg-zinc-900/70 text-zinc-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.context_refs && message.context_refs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.context_refs.map((ref) => (
                      <button
                        key={`${ref.source_type}-${ref.source_id}-${ref.title}`}
                        type="button"
                        onClick={() =>
                          setPreviewRef({
                            source_type: ref.source_type,
                            source_id: ref.source_id,
                            title: ref.title,
                            url: ref.url,
                            score: ref.score,
                            chunkText: ref.chunk_text,
                          })
                        }
                        className="rounded-full border border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                      >
                        {ref.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {(searching || streaming) && (
            <p className="text-xs text-zinc-500">
              {searching ? 'Searching knowledge base…' : 'Generating reply…'}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-700 p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Ask your second brain… (Cmd/Ctrl+Enter to send)"
            className="border-zinc-600 bg-zinc-900 text-white"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500">
              ~{Math.ceil(draft.trim().split(/\s+/).filter(Boolean).length * 1.3)} tokens
            </span>
            <Button
              type="button"
              disabled={streaming || !draft.trim()}
              className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
              onClick={() => void sendMessage()}
            >
              Send
            </Button>
          </div>
        </div>
      </section>

      <BrainSourcePreviewDrawer
        accountId={accountId}
        accountSlug={accountSlug}
        previewRef={previewRef}
        onClose={() => setPreviewRef(null)}
      />
    </div>
  );
}
