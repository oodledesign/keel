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
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  previewEmailBody,
  splitEmailQuotedHistory,
} from '~/lib/email-assistant/message-body-display';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';

import { loadEmailThreadDetail } from '../_lib/actions/email-assistant-actions';
import { emailApiFetch } from '../_lib/email-api';
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
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [acceptItem, setAcceptItem] = useState<EmailActionItemRow | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [extractInstructions, setExtractInstructions] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!threadId) {
      setDetail(null);
      setDraftBody('');
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void loadEmailThreadDetail(threadId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        toast.error(result.error);
        setDetail(null);
        setDraftBody('');
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      setDetail(result.data);
      setDraftBody(result.data.draft?.body_text ?? '');
      setLoadError(null);
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
          {
            method: 'POST',
            body: JSON.stringify({
              instructions: extractInstructions.trim() || undefined,
            }),
          },
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
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Select a thread
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Choose a conversation from your inbox to review messages, suggested
            to-dos, and draft a reply.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]',
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading thread…
      </section>
    );
  }

  if (!detail) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center px-6 py-12 text-center',
        )}
      >
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {loadError ? 'Could not load thread' : 'Thread unavailable'}
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {loadError ?? 'Choose another conversation from your inbox.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={cn(
          panelClass,
          'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
        )}
      >
        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div className="flex items-start gap-3">
            {showBackButton && onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] lg:hidden"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-[var(--workspace-shell-text)]">
                {detail.thread.subject?.trim() || '(no subject)'}
              </h2>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                {detail.messages.length} message
                {detail.messages.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <EmailThreadLinkSection
            threadId={threadId}
            link={detail.thread.link}
            workspaces={workspaces}
            onUpdated={() => refreshDetail()}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4">
          <ThreadMessages messages={detail.messages} />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Suggested to-dos
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
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

            <div className="space-y-2">
              <Label
                htmlFor="email-extract-instructions"
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                Extraction instructions{' '}
                <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id="email-extract-instructions"
                value={extractInstructions}
                onChange={(e) => setExtractInstructions(e.target.value)}
                placeholder="e.g. Put everything I need to email Tim into one task, with bullet points in the notes"
                className="min-h-[68px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>

            {suggestedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
                No open suggestions yet. Extract action items from this thread
                with AI.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestedItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/50 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                            {item.detail}
                          </p>
                        ) : null}
                        {item.suggested_due_date || item.linkLabel ? (
                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                            {item.suggested_due_date ? (
                              <span>
                                Suggested due{' '}
                                {formatDueDate(item.suggested_due_date)}
                              </span>
                            ) : null}
                            {item.suggested_due_date && item.linkLabel ? (
                              <span className="text-[var(--workspace-shell-text-muted)]">
                                ·
                              </span>
                            ) : null}
                            {item.linkLabel ? (
                              <span className="text-[var(--ozer-accent)]">
                                {item.linkLabel}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          className="ozer-gradient-btn h-8 px-3 text-[var(--workspace-shell-text)]"
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
                          className="h-8 border-[color:var(--workspace-shell-border)] bg-transparent px-3 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
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
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Resolved
                </p>
                <ul className="space-y-2">
                  {resolvedItems.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]"
                    >
                      <span className="text-[var(--workspace-shell-text-muted)]">
                        {item.title}
                      </span>
                      <span className="ml-2 text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Draft reply
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
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
              className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="ozer-gradient-btn text-[var(--ozer-white)]"
                onClick={runSaveDraft}
                disabled={pending || !connected || !detail.draft}
              >
                Save to Gmail
              </Button>
              {detail.draft?.status === 'saved_to_gmail' ? (
                <span className="text-xs text-[var(--ozer-accent)]">
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
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Messages
      </h3>
      <ul className="space-y-2">
        {messages.map((message) => {
          const isLatest = message.id === latestMessageId;
          const isExpanded = isLatest || expandedOlderIds.has(message.id);
          const rawBody =
            message.body_text?.trim() || message.snippet?.trim() || '';
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
                  className="flex w-full items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/25 px-3 py-2.5 text-left transition-colors hover:bg-[var(--ozer-surface-canvas)]/40"
                >
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-[var(--workspace-shell-text-muted)]">
                        {message.from_address ?? 'Unknown sender'}
                      </p>
                      <p className="shrink-0 text-xs tabular-nums text-[var(--workspace-shell-text-muted)]">
                        {formatEmailDateTime(message.internal_date)}
                      </p>
                    </div>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">
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
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40 p-3"
            >
              <div className="flex items-start gap-2">
                {!isLatest ? (
                  <button
                    type="button"
                    onClick={() => toggleOlderMessage(message.id)}
                    className="mt-0.5 shrink-0 rounded-md p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text-muted)]"
                    aria-label="Collapse message"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-medium text-[var(--workspace-shell-text)]">
                      {message.from_address ?? 'Unknown sender'}
                    </p>
                    <p className="shrink-0 text-xs tabular-nums text-[var(--workspace-shell-text-muted)]">
                      {formatEmailDateTime(message.internal_date)}
                    </p>
                  </div>
                  <p className="mt-3 break-words text-sm leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                    {body}
                  </p>
                  {quoted ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleQuotedHistory(message.id)}
                        className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
                      >
                        {showQuoted
                          ? 'Hide quoted history'
                          : 'Show quoted history'}
                      </button>
                      {showQuoted ? (
                        <p className="mt-2 border-l border-[color:var(--workspace-shell-border)] pl-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
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
