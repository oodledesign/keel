'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';

import {
  ArrowLeft,
  BookOpen,
  Home,
  LifeBuoy,
  ListChecks,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  type SupportAttachmentItem,
  SupportAttachmentUploader,
  uploadSupportAttachmentFiles,
} from '~/components/support/support-attachment-uploader';
import { loadPlatformSupportAccountOptions } from '~/lib/support/load-platform-support-account-options';
import type { PlatformSupportTicketDetail } from '~/lib/support/load-platform-support-ticket';
import {
  type PlatformSupportMessengerTicketSummary,
  loadPlatformSupportMessengerBootstrap,
  loadPlatformSupportMessengerTicketAction,
} from '~/lib/support/platform-support-messenger.actions';
import {
  createPlatformSupportTicketAction,
  replyPlatformSupportTicketAction,
} from '~/lib/support/platform-support.actions';
import {
  PLATFORM_SUPPORT_CATEGORIES,
  PLATFORM_SUPPORT_CATEGORY_LABELS,
  type PlatformSupportTicketCategory,
  formatPlatformTicketNumber,
} from '~/lib/support/platform-support.types';

import { GuidesView } from './guides-view';
import type { PlatformSupportMessengerView } from './platform-support-messenger-context';

type View = PlatformSupportMessengerView;

type DocsChatSource = {
  title: string;
  path: string;
  url: string;
};

type DocsChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocsChatSource[];
  crisis?: boolean;
};

type PlatformSupportMessengerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string | null;
  /** View to show when the messenger opens (profile Support → new). */
  initialView?: Exclude<View, 'thread'>;
};

function subjectFromBody(body: string) {
  const line = body
    .trim()
    .split(/\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return 'Support request';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

function formatShortTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function PlatformSupportMessenger({
  open,
  onOpenChange,
  defaultAccountId = null,
  initialView = 'home',
}: PlatformSupportMessengerProps) {
  const [view, setView] = useState<View>(initialView);
  const [firstName, setFirstName] = useState('there');
  const [tickets, setTickets] = useState<
    PlatformSupportMessengerTicketSummary[]
  >([]);
  const [accountOptions, setAccountOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [thread, setThread] = useState<PlatformSupportTicketDetail | null>(
    null,
  );
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [pending, startTransition] = useTransition();

  const refreshTickets = useCallback(async () => {
    const boot = await loadPlatformSupportMessengerBootstrap({});
    setFirstName(boot.profile.firstName);
    setTickets(boot.tickets);
  }, []);

  const openTicket = useCallback(async (ticketId: string) => {
    setActiveTicketId(ticketId);
    setView('thread');
    setLoadingThread(true);
    try {
      const detail = await loadPlatformSupportMessengerTicketAction({
        ticketId,
      });
      setThread(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load chat');
      setView('messages');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingBootstrap(true);

    void Promise.all([
      loadPlatformSupportMessengerBootstrap({}),
      loadPlatformSupportAccountOptions(),
    ])
      .then(([boot, accounts]) => {
        if (cancelled) return;
        setFirstName(boot.profile.firstName);
        setTickets(boot.tickets);
        setAccountOptions(accounts);
      })
      .catch(() => {
        if (!cancelled) {
          setTickets([]);
          setAccountOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBootstrap(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setView('home');
      setActiveTicketId(null);
      setThread(null);
      return;
    }

    setView(initialView);
    setActiveTicketId(null);
    setThread(null);
  }, [open, initialView]);

  if (!open) return null;

  const recentTickets = tickets
    .filter((t) => !['resolved', 'closed'].includes(t.status))
    .slice(0, 5);

  return (
    <div
      data-tour="support-messenger"
      className={cn(
        'fixed z-[60] flex flex-col overflow-hidden border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_12px_40px_rgba(42,23,32,0.18)]',
        'right-3 bottom-[5.5rem] h-[min(640px,calc(100dvh-7rem))] w-[calc(100vw-1.5rem)] max-w-[380px] rounded-2xl',
        'lg:right-4 lg:bottom-20 lg:h-[min(640px,calc(100dvh-6.5rem))]',
      )}
      role="dialog"
      aria-label="Ozer support messenger"
    >
      <header className="relative shrink-0 bg-[var(--ozer-plum-900)] px-4 pt-4 pb-5 text-[var(--ozer-text-on-dark)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {(view === 'thread' || view === 'new' || view === 'ask') && (
              <button
                type="button"
                className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--ozer-text-on-dark)]/80 hover:text-[var(--ozer-text-on-dark)]"
                onClick={() => {
                  if (view === 'new' || view === 'ask') {
                    setView('home');
                  } else {
                    setView('messages');
                  }
                  setActiveTicketId(null);
                  setThread(null);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <p className="font-heading text-xl font-semibold tracking-tight">
              {view === 'home'
                ? `Hi ${firstName}`
                : view === 'messages'
                  ? 'Messages'
                  : view === 'guides'
                    ? 'Guides'
                    : view === 'new'
                      ? 'New conversation'
                      : view === 'ask'
                        ? 'Ask docs'
                        : (thread?.subject ?? 'Conversation')}
            </p>
            {view === 'home' ? (
              <p className="mt-1 text-sm text-[var(--ozer-text-on-dark)]/75">
                Chat with Ozer support
              </p>
            ) : null}
            {view === 'guides' ? (
              <p className="mt-1 text-sm text-[var(--ozer-text-on-dark)]/75">
                Walkthroughs and your guide history
              </p>
            ) : null}
            {view === 'ask' ? (
              <p className="mt-1 text-sm text-[var(--ozer-text-on-dark)]/75">
                Answers from product docs
              </p>
            ) : null}
            {view === 'thread' && thread ? (
              <p className="mt-1 text-xs text-[var(--ozer-text-on-dark)]/70 capitalize">
                {formatPlatformTicketNumber(thread.ticketNumber)} ·{' '}
                {statusLabel(thread.status)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-[var(--ozer-text-on-dark)]/80 transition-colors hover:bg-white/10 hover:text-[var(--ozer-text-on-dark)]"
            aria-label="Close support"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)]">
        {view === 'home' ? (
          <HomeView
            loading={loadingBootstrap}
            recentTickets={recentTickets}
            onAskDocs={() => setView('ask')}
            onGuides={() => setView('guides')}
            onStart={() => setView('new')}
            onOpenTicket={(id) => void openTicket(id)}
            onSeeAll={() => setView('messages')}
          />
        ) : null}

        {view === 'ask' ? (
          <AskDocsView onContactSupport={() => setView('new')} />
        ) : null}

        {view === 'messages' ? (
          <MessagesView
            loading={loadingBootstrap}
            tickets={tickets}
            onOpenTicket={(id) => void openTicket(id)}
            onStart={() => setView('new')}
          />
        ) : null}

        {view === 'guides' ? <GuidesView accountId={defaultAccountId} /> : null}

        {view === 'new' ? (
          <NewConversationView
            accountOptions={accountOptions}
            defaultAccountId={defaultAccountId}
            pending={pending}
            onSubmit={(input) => {
              startTransition(async () => {
                try {
                  const result = await createPlatformSupportTicketAction(input);
                  toast.success('Message sent');
                  await refreshTickets();
                  await openTicket(result.id);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : 'Could not send',
                  );
                }
              });
            }}
          />
        ) : null}

        {view === 'thread' ? (
          <ThreadView
            loading={loadingThread}
            thread={thread}
            pending={pending}
            onReply={async (body, attachments) => {
              if (!activeTicketId) {
                throw new Error('No active conversation');
              }
              await replyPlatformSupportTicketAction({
                ticketId: activeTicketId,
                body,
                attachments,
              });
              const detail = await loadPlatformSupportMessengerTicketAction({
                ticketId: activeTicketId,
              });
              setThread(detail);
              await refreshTickets();
            }}
            startTransition={startTransition}
          />
        ) : null}
      </div>

      {(view === 'home' || view === 'messages' || view === 'guides') && (
        <nav className="grid shrink-0 grid-cols-3 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <TabButton
            active={view === 'home'}
            icon={<Home className="h-4 w-4" />}
            label="Home"
            onClick={() => setView('home')}
          />
          <TabButton
            active={view === 'messages'}
            icon={<MessageCircle className="h-4 w-4" />}
            label="Messages"
            onClick={() => setView('messages')}
          />
          <TabButton
            active={view === 'guides'}
            icon={<ListChecks className="h-4 w-4" />}
            label="Guides"
            onClick={() => setView('guides')}
          />
        </nav>
      )}
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-2.5 text-xs font-medium transition-colors',
        props.active
          ? 'text-[var(--ozer-accent)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function HomeView(props: {
  loading: boolean;
  recentTickets: PlatformSupportMessengerTicketSummary[];
  onAskDocs: () => void;
  onGuides: () => void;
  onStart: () => void;
  onOpenTicket: (id: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <button
        type="button"
        onClick={props.onAskDocs}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-4 text-left shadow-sm transition-colors hover:bg-[var(--workspace-shell-canvas)]"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Ask docs
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            Free AI answers from the product guides — rate limited.
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-plum-900)]/10 text-[var(--ozer-plum-900)]">
          <BookOpen className="h-5 w-5" />
        </span>
      </button>

      <button
        type="button"
        onClick={props.onGuides}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-4 text-left shadow-sm transition-colors hover:bg-[var(--workspace-shell-canvas)]"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Guides
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            Active walkthroughs and your guide history.
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-plum-900)]/10 text-[var(--ozer-plum-900)]">
          <ListChecks className="h-5 w-5" />
        </span>
      </button>

      <button
        type="button"
        onClick={props.onStart}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--ozer-accent)] px-4 py-4 text-left text-[var(--ozer-white)] shadow-sm transition-colors hover:bg-[var(--ozer-accent-hover)]"
      >
        <div>
          <p className="text-sm font-semibold">Contact support</p>
          <p className="mt-0.5 text-xs text-[var(--ozer-white)]/85">
            Message the Ozer team — we usually reply within a day.
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <LifeBuoy className="h-5 w-5" />
        </span>
      </button>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Recent conversations
          </h3>
          {props.recentTickets.length > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
              onClick={props.onSeeAll}
            >
              See all
            </button>
          ) : null}
        </div>

        {props.loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--workspace-shell-text-muted)]" />
          </div>
        ) : props.recentTickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            No open conversations yet. Start one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {props.recentTickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onClick={() => props.onOpenTicket(ticket.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocsChatMarkdown({ content }: { content: string }) {
  return (
    <div className="docs-chat-md space-y-2 text-sm leading-relaxed [&_:first-child]:mt-0 [&_:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-[var(--workspace-shell-text)]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--workspace-shell-text)]">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-4">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-[var(--workspace-shell-text)]">
              {children}
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--ozer-accent)] underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes('language-'));
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-[var(--workspace-shell-canvas)] px-2.5 py-2 font-mono text-[12px] text-[var(--workspace-shell-text)]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-[var(--workspace-shell-canvas)] px-1 py-0.5 font-mono text-[12px] text-[var(--workspace-shell-text)]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-[var(--workspace-shell-canvas)] p-0">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Progressive reveal so answers feel streamed even when the API returns all at once. */
function useRevealMarkdown(full: string, enabled: boolean) {
  const [shown, setShown] = useState(enabled ? '' : full);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setShown(full);
      setDone(true);
      return;
    }

    setShown('');
    setDone(false);
    if (!full) {
      setDone(true);
      return;
    }

    // Reveal by paragraph / line blocks so markdown markers stay intact.
    const blocks = full.split(/(\n{2,})/);
    let blockIndex = 0;
    let acc = '';

    const timer = setInterval(() => {
      if (blockIndex >= blocks.length) {
        clearInterval(timer);
        setShown(full);
        setDone(true);
        return;
      }
      acc += blocks[blockIndex] ?? '';
      blockIndex += 1;
      // Keep consuming separator tokens in the same tick.
      while (
        blockIndex < blocks.length &&
        /^\n+$/.test(blocks[blockIndex] ?? '')
      ) {
        acc += blocks[blockIndex] ?? '';
        blockIndex += 1;
      }
      setShown(acc);
      if (blockIndex >= blocks.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 90);

    return () => clearInterval(timer);
  }, [full, enabled]);

  return { shown, done };
}

function AskDocsAssistantBubble(props: {
  content: string;
  sources?: DocsChatSource[];
  animate: boolean;
  /** Should be a stable callback (e.g. useCallback). */
  onContentChange?: () => void;
}) {
  const { shown: revealed, done } = useRevealMarkdown(
    props.content,
    props.animate,
  );

  useEffect(() => {
    props.onContentChange?.();
  }, [revealed, props.onContentChange]);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'mr-auto max-w-[92%] rounded-2xl bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm text-[var(--workspace-shell-text)] ring-1 ring-[color:var(--workspace-shell-border)]',
        props.animate &&
          'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500',
      )}
    >
      <DocsChatMarkdown content={revealed || '…'} />
      {done && props.sources && props.sources.length > 0 ? (
        <div className="animate-in fade-in mt-2 flex flex-wrap gap-1.5 duration-300">
          {props.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[var(--workspace-shell-canvas)] px-2 py-0.5 text-[11px] font-medium text-[var(--ozer-accent)] ring-1 ring-[color:var(--workspace-shell-border)] hover:underline"
            >
              {source.title}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AskDocsView(props: { onContactSupport: () => void }) {
  const [messages, setMessages] = useState<DocsChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sawCrisis, setSawCrisis] = useState(false);
  const [animateMessageIds, setAnimateMessageIds] = useState(
    () => new Set<string>(),
  );
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, animateMessageIds, scrollToBottom]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMessage: DocsChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setDraft('');
    setSending(true);

    try {
      const response = await fetch('/api/support/docs-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(-6).map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      if (response.status === 429) {
        toast.error('You’ve asked a lot — try again in a minute');
        setMessages((prev) => prev.slice(0, -1));
        setDraft(text);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessages((prev) => prev.slice(0, -1));
        setDraft(text);
        throw new Error(payload?.error || 'Could not get an answer');
      }

      const payload = (await response.json()) as {
        answer: string;
        sources?: DocsChatSource[];
        crisis?: boolean;
      };

      if (payload.crisis) {
        setSawCrisis(true);
      }

      const assistantId = `a-${Date.now()}`;
      setAnimateMessageIds((prev) => new Set(prev).add(assistantId));
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: payload.answer,
          sources: payload.sources ?? [],
          crisis: Boolean(payload.crisis),
        },
      ]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not get an answer',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            Ask how something works in Ozer — invoices, tasks, email assistant,
            and more. Answers come from the public product docs.
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div
              key={message.id}
              className="ml-auto max-w-[92%] rounded-2xl bg-[var(--ozer-accent)] px-3 py-2 text-sm whitespace-pre-wrap text-[var(--ozer-white)]"
            >
              {message.content}
            </div>
          ) : (
            <AskDocsAssistantBubble
              key={message.id}
              content={message.content}
              sources={message.sources}
              animate={animateMessageIds.has(message.id)}
              onContentChange={scrollToBottom}
            />
          ),
        )}

        {sending ? (
          <div className="animate-in fade-in mr-auto flex items-center gap-2 rounded-2xl bg-[var(--workspace-shell-panel)] px-3 py-2 text-xs text-[var(--workspace-shell-text-muted)] ring-1 ring-[color:var(--workspace-shell-border)] duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching docs…
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
        {!sawCrisis ? (
          <button
            type="button"
            onClick={props.onContactSupport}
            className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Still stuck? Contact support
          </button>
        ) : null}

        <p className="text-[11px] leading-snug text-[var(--workspace-shell-text-muted)]">
          AI answers from product docs. Don’t share passwords or personal data.{' '}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question…"
            rows={2}
            maxLength={1000}
            className="min-h-[52px] flex-1 resize-none"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={sending || !draft.trim()}
            onClick={() => void send()}
            aria-label="Send question"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessagesView(props: {
  loading: boolean;
  tickets: PlatformSupportMessengerTicketSummary[];
  onOpenTicket: (id: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {props.loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--workspace-shell-text-muted)]" />
          </div>
        ) : props.tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {props.tickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onClick={() => props.onOpenTicket(ticket.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0 border-t border-[color:var(--workspace-shell-border)] p-3">
        <Button
          type="button"
          className="w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={props.onStart}
        >
          Start a conversation
        </Button>
      </div>
    </div>
  );
}

function TicketRow(props: {
  ticket: PlatformSupportMessengerTicketSummary;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={props.onClick}
        className="flex w-full items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-3 text-left transition-colors hover:border-[var(--ozer-accent)]/30"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
            {props.ticket.subject}
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {formatPlatformTicketNumber(props.ticket.ticketNumber)} ·{' '}
            <span className="capitalize">
              {statusLabel(props.ticket.status)}
            </span>
          </p>
        </div>
        <time className="shrink-0 text-[11px] text-[var(--workspace-shell-text-muted)]">
          {formatShortTime(props.ticket.updatedAt)}
        </time>
      </button>
    </li>
  );
}

function NewConversationView(props: {
  accountOptions: Array<{ id: string; label: string }>;
  defaultAccountId?: string | null;
  pending: boolean;
  onSubmit: (input: {
    subject: string;
    body: string;
    category: PlatformSupportTicketCategory;
    accountId: string | null;
    attachments: SupportAttachmentItem[];
  }) => void;
}) {
  const [category, setCategory] =
    useState<PlatformSupportTicketCategory>('question');
  const [accountId, setAccountId] = useState(props.defaultAccountId ?? '');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    setAccountId(props.defaultAccountId ?? '');
  }, [props.defaultAccountId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Topic
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_SUPPORT_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  category === value
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text-muted)] ring-1 ring-[color:var(--workspace-shell-border)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {PLATFORM_SUPPORT_CATEGORY_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {props.accountOptions.length > 0 ? (
          <div>
            <label
              htmlFor="messenger-account"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase"
            >
              Workspace (optional)
            </label>
            <select
              id="messenger-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
            >
              <option value="">None</option>
              {props.accountOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Tell us what you need help with. Your first message starts the
            conversation with the Ozer team.
          </p>
        </div>

        {showAttach ? (
          <SupportAttachmentUploader
            platformSupport
            compact
            value={attachments}
            onChange={setAttachments}
          />
        ) : null}
      </div>

      <ComposerBar
        value={body}
        onChange={setBody}
        pending={props.pending}
        placeholder="Send a message to Ozer…"
        onAttach={() => setShowAttach((v) => !v)}
        attachActive={showAttach || attachments.length > 0}
        onFilesDropped={async (files) => {
          setShowAttach(true);
          try {
            const next = await uploadSupportAttachmentFiles({
              files,
              context: { platformSupport: true },
              existing: attachments,
            });
            setAttachments(next);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : 'Upload failed',
            );
          }
        }}
        onSend={() => {
          const trimmed = body.trim();
          if (trimmed.length < 10) {
            toast.error('Please write a bit more so we can help');
            return;
          }
          props.onSubmit({
            subject: subjectFromBody(trimmed),
            body: trimmed,
            category,
            accountId: accountId || null,
            attachments,
          });
        }}
      />
    </div>
  );
}

function ThreadView(props: {
  loading: boolean;
  thread: PlatformSupportTicketDetail | null;
  pending: boolean;
  onReply: (
    body: string,
    attachments: SupportAttachmentItem[],
  ) => Promise<void>;
  startTransition: (fn: () => Promise<void> | void) => void;
}) {
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.thread?.messages.length, props.thread?.id]);

  if (props.loading || !props.thread) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--workspace-shell-text-muted)]" />
      </div>
    );
  }

  const messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    fromUser: boolean;
    attachments: SupportAttachmentItem[];
  }> = [
    {
      id: 'opening',
      body: props.thread.body,
      createdAt: props.thread.createdAt,
      fromUser: true,
      attachments: props.thread.attachments ?? [],
    },
    ...props.thread.messages
      .filter((m) => !m.isInternalNote)
      .map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        fromUser: m.authorIsCurrentUser,
        attachments: m.attachments ?? [],
      })),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
      >
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {showAttach ? (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
            <SupportAttachmentUploader
              platformSupport
              compact
              value={attachments}
              onChange={setAttachments}
            />
          </div>
        ) : null}
      </div>

      <ComposerBar
        value={body}
        onChange={setBody}
        pending={props.pending}
        placeholder="Write a reply…"
        onAttach={() => setShowAttach((v) => !v)}
        attachActive={showAttach || attachments.length > 0}
        onFilesDropped={async (files) => {
          setShowAttach(true);
          try {
            const next = await uploadSupportAttachmentFiles({
              files,
              context: { platformSupport: true },
              existing: attachments,
            });
            setAttachments(next);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : 'Upload failed',
            );
          }
        }}
        onSend={() => {
          const trimmed = body.trim();
          if (!trimmed) return;
          const pendingAttachments = attachments;
          props.startTransition(async () => {
            try {
              await props.onReply(trimmed, pendingAttachments);
              setBody('');
              setAttachments([]);
              setShowAttach(false);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : 'Could not send',
              );
            }
          });
        }}
      />
    </div>
  );
}

function ChatBubble(props: {
  message: {
    body: string;
    createdAt: string;
    fromUser: boolean;
    attachments: SupportAttachmentItem[];
  };
}) {
  const { message } = props;
  return (
    <div
      className={cn('flex', message.fromUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          message.fromUser
            ? 'rounded-br-md bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
            : 'rounded-bl-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
        )}
      >
        {!message.fromUser ? (
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-[var(--ozer-accent)] uppercase">
            Ozer
          </p>
        ) : null}
        <p className="whitespace-pre-wrap">{message.body}</p>
        {message.attachments.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {message.attachments.map((file) => (
              <li key={file.url}>
                {file.mimeType.startsWith('image/') ? (
                  <a href={file.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt={file.name}
                      className="max-h-40 max-w-full rounded-lg border object-contain"
                    />
                  </a>
                ) : (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--ozer-accent)] underline"
                  >
                    {file.name}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-[10px] text-[var(--workspace-shell-text-muted)]">
          {formatShortTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ComposerBar(props: {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  placeholder: string;
  onSend: () => void;
  onAttach: () => void;
  attachActive: boolean;
  onFilesDropped?: (files: File[]) => void | Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="shrink-0 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border bg-[var(--workspace-shell-canvas)] px-2 py-2 transition-colors',
          dragOver
            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
            : 'border-[color:var(--workspace-shell-border)]',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (props.onFilesDropped) setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (props.onFilesDropped) setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const files = Array.from(event.dataTransfer.files);
          if (files.length > 0) {
            void props.onFilesDropped?.(files);
          }
        }}
      >
        <button
          type="button"
          className={cn(
            'mb-0.5 rounded-full p-2 transition-colors',
            props.attachActive
              ? 'text-[var(--ozer-accent)]'
              : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
          )}
          aria-label="Add attachment"
          onClick={props.onAttach}
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <Textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={dragOver ? 'Drop files to attach…' : props.placeholder}
          rows={1}
          className="max-h-28 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!props.pending) props.onSend();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={props.pending || !props.value.trim()}
          className="mb-0.5 h-9 w-9 shrink-0 rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={props.onSend}
          aria-label="Send message"
        >
          {props.pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
