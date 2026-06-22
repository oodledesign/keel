'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';
import { toast } from '@kit/ui/sonner';

import { loadEmailThreadDetail } from '../_lib/actions/email-assistant-actions';
import { emailApiFetch } from '../_lib/email-api';
import {
  previewEmailBody,
  splitEmailQuotedHistory,
} from '~/lib/email-assistant/message-body-display';
import type {
  EmailActionItemRow,
  EmailDraftRow,
  EmailMessageRow,
  EmailThreadDetail,
  EmailThreadSummary,
  EmailWorkspaceOption,
} from '../_lib/types';
import { AcceptActionItemDialog } from './accept-action-item-dialog';
import { EmailThreadLinkSection } from './email-thread-link-section';

const panelClass =
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

function formatMessageDate(value: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDueDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Props = {
  threadId: string | null;
  connected: boolean;
  workspaces: EmailWorkspaceOption[];
  onBack?: () => void;
  showBackButton?: boolean;
};

export function EmailThreadPanel({
  threadId,
  connected,
  workspaces,
  onBack,
  showBackButton = false,
}: Props) {
  const [detail, setDetail] = useState<EmailThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [acceptItem, setAcceptItem] = useState<EmailActionItemRow | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!threadId) {
      setDetail(null);
      setDraftBody('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadEmailThreadDetail(threadId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        toast.error(result.error);
        setDetail(null);
        setDraftBody('');
        setLoading(false);
        return;
      }

      setDetail(result.data);
      setDraftBody(result.data.draft?.body_text ?? '');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const suggestedItems = useMemo(
    () =>
      (detail?.actionItems ?? []).filter((item) => item.status === 'suggested'),
    [detail?.actionItems],
  );

  const resolvedItems = useMemo(
    () =>
      (detail?.actionItems ?? []).filter((item) => item.status !== 'suggested'),
    [detail?.actionItems],
  );

  function refreshDetail() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      const result = await loadEmailThreadDetail(threadId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setDetail(result.data);
      setDraftBody(result.data.draft?.body_text ?? '');
    });
  }

  function runExtract() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      try {
        await emailApiFetch<{ items: EmailActionItemRow[] }>(
          `/api/gmail/threads/${threadId}/extract`,
          { method: 'POST' },
        );
        toast.success('Suggested to-dos updated');
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Extraction failed',
        );
      }
    });
  }

  function runDismiss(itemId: string) {
    startTransition(async () => {
      try {
        await emailApiFetch(`/api/email-actions/${itemId}/dismiss`, {
          method: 'POST',
        });
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not dismiss item',
        );
      }
    });
  }

  function runGenerateDraft() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await emailApiFetch<{ draft: EmailDraftRow }>(
          `/api/gmail/threads/${threadId}/draft`,
          { method: 'POST' },
        );
        setDetail((current) =>
          current ? { ...current, draft: data.draft } : current,
        );
        setDraftBody(data.draft.body_text);
        toast.success('Draft generated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Draft generation failed',
        );
      }
    });
  }

  function runSaveDraft() {
    const draftId = detail?.draft?.id;

    if (!draftId) {
      toast.error('Generate a draft first');
      return;
    }

    if (!draftBody.trim()) {
      toast.error('Draft body is required');
      return;
    }

    startTransition(async () => {
      try {
        await emailApiFetch(`/api/gmail/drafts/${draftId}/save`, {
          method: 'POST',
          body: JSON.stringify({ bodyText: draftBody }),
        });
        toast.success('Saved to Gmail drafts');
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save to Gmail',
        );
      }
    });
  }

  if (!threadId) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center px-6 py-12 text-center',
        )}
      >
        <div>
          <p className="text-sm font-medium text-white">Select a thread</p>
          <p className="mt-1 text-sm text-zinc-500">
            Choose a conversation from your inbox to review messages, suggested
            to-dos, and draft a reply.
          </p>
        </div>
      </section>
    );
  }

  if (loading || !detail) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center gap-2 text-sm text-zinc-400',
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading thread…
      </section>
    );
  }

  return (
    <>
      <section className={cn(panelClass, 'flex min-h-0 flex-col overflow-hidden')}>
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-start gap-3">
            {showBackButton && onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 text-zinc-300 hover:bg-white/5 hover:text-white lg:hidden"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-white">
                {detail.thread.subject?.trim() || '(no subject)'}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {detail.messages.length} message
                {detail.messages.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <EmailThreadLinkSection
            threadId={threadId}
            link={detail.thread.link}
            workspaces={workspaces}
            onUpdated={() => refreshDetail()}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <ThreadMessages messages={detail.messages} />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">
                Suggested to-dos
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/5"
                onClick={runExtract}
                disabled={pending || !connected}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {suggestedItems.length > 0 ? 'Refresh' : 'Extract'}
              </Button>
            </div>

            {suggestedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">
                No open suggestions yet. Extract action items from this thread
                with AI.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestedItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-[#0B132B]/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-1 text-sm text-zinc-400">
                            {item.detail}
                          </p>
                        ) : null}
                        {item.suggested_due_date || item.linkLabel ? (
                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                            {item.suggested_due_date ? (
                              <span>
                                Suggested due{' '}
                                {formatDueDate(item.suggested_due_date)}
                              </span>
                            ) : null}
                            {item.suggested_due_date && item.linkLabel ? (
                              <span className="text-zinc-600">·</span>
                            ) : null}
                            {item.linkLabel ? (
                              <span className="text-[var(--keel-teal)]">
                                {item.linkLabel}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="keel-gradient-btn h-8 px-3 text-white"
                          onClick={() => {
                            setAcceptItem(item);
                            setAcceptOpen(true);
                          }}
                          disabled={pending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-white/10 bg-transparent px-3 text-white hover:bg-white/5"
                          onClick={() => runDismiss(item.id)}
                          disabled={pending}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {resolvedItems.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Resolved
                </p>
                <ul className="space-y-2">
                  {resolvedItems.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-white/5 px-3 py-2 text-sm text-zinc-400"
                    >
                      <span className="text-zinc-300">{item.title}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500">
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Draft reply</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/5"
                onClick={runGenerateDraft}
                disabled={pending || !connected}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate
              </Button>
            </div>

            <Textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Generate a reply, edit it here, then save to Gmail."
              rows={10}
              className="border-white/10 bg-[#0B132B] text-white placeholder:text-zinc-500"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="keel-gradient-btn text-white"
                onClick={runSaveDraft}
                disabled={pending || !connected || !detail.draft}
              >
                Save to Gmail
              </Button>
              {detail.draft?.status === 'saved_to_gmail' ? (
                <span className="text-xs text-[var(--keel-teal)]">
                  Saved to Gmail
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <AcceptActionItemDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        actionItem={acceptItem}
        threadLink={detail.thread.link}
        workspaces={workspaces}
        onAccepted={refreshDetail}
      />
    </>
  );
}

function ThreadMessages({ messages }: { messages: EmailMessageRow[] }) {
  const [expandedOlderIds, setExpandedOlderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQuotedIds, setShowQuotedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setExpandedOlderIds(new Set());
    setShowQuotedIds(new Set());
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  const latestMessageId = messages[messages.length - 1]?.id;

  function toggleOlderMessage(messageId: string) {
    setExpandedOlderIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  function toggleQuotedHistory(messageId: string) {
    setShowQuotedIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">Messages</h3>
      <ul className="space-y-2">
        {messages.map((message) => {
          const isLatest = message.id === latestMessageId;
          const isExpanded = isLatest || expandedOlderIds.has(message.id);
          const rawBody =
            message.body_text?.trim() ||
            message.snippet?.trim() ||
            '';
          const { visible, quoted } = splitEmailQuotedHistory(rawBody);
          const body = visible || '(no content)';
          const preview = previewEmailBody(rawBody);
          const showQuoted = showQuotedIds.has(message.id);

          if (!isExpanded) {
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => toggleOlderMessage(message.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-[#0B132B]/25 px-3 py-2.5 text-left transition-colors hover:bg-[#0B132B]/40"
                >
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-300">
                        {message.from_address ?? 'Unknown sender'}
                      </p>
                      <p className="shrink-0 text-xs text-zinc-500">
                        {formatMessageDate(message.internal_date)}
                      </p>
                    </div>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                        {preview}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          }

          return (
            <li
              key={message.id}
              className="rounded-xl border border-white/10 bg-[#0B132B]/40 p-3"
            >
              <div className="flex items-start gap-2">
                {!isLatest ? (
                  <button
                    type="button"
                    onClick={() => toggleOlderMessage(message.id)}
                    className="mt-0.5 shrink-0 rounded-md p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    aria-label="Collapse message"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {message.from_address ?? 'Unknown sender'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatMessageDate(message.internal_date)}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {body}
                  </p>
                  {quoted ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleQuotedHistory(message.id)}
                        className="text-xs font-medium text-[var(--keel-teal)] hover:underline"
                      >
                        {showQuoted ? 'Hide quoted history' : 'Show quoted history'}
                      </button>
                      {showQuoted ? (
                        <p className="mt-2 whitespace-pre-wrap border-l border-white/10 pl-3 text-sm leading-relaxed text-zinc-500">
                          {quoted}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
