'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Loader2, MessageSquareText, SendHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';
import { isInsufficientAiCreditsMessage } from '~/lib/ai/ai-credits-exhausted';

import { askMeetingQuestion } from '../../meeting-transcripts/_lib/server/server-actions';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  accountId: string;
  transcriptId: string;
  disabled?: boolean;
};

export function MeetingTranscriptQaChat({
  accountId,
  transcriptId,
  disabled = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending]);

  const send = () => {
    const question = draft.trim();
    if (!question || pending || disabled) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };

    setDraft('');
    setMessages((prev) => [...prev, userMessage]);

    startTransition(async () => {
      try {
        const history = messages.map((message) => ({
          role: message.role,
          content: message.content,
        }));

        const result = await askMeetingQuestion({
          accountId,
          transcriptId,
          question,
          history,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.answer,
          },
        ]);
      } catch (error) {
        setMessages((prev) =>
          prev.filter((message) => message.id !== userMessage.id),
        );
        setDraft(question);

        const message =
          error instanceof Error ? error.message : 'Failed to answer question';

        if (isInsufficientAiCreditsMessage(message)) {
          toast.error('Not enough AI credits for this question');
          return;
        }

        toast.error(message);
      }
    });
  };

  return (
    <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-[var(--ozer-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Ask about this meeting
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
        Ask questions grounded in this transcript and summary. Uses 3 AI credits
        per question.
      </p>

      <div
        ref={listRef}
        className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3"
      >
        {messages.length === 0 && !pending ? (
          <p className="py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            Try “What decisions were made?” or “What did Alex commit to?”
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'ml-6 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                  : 'mr-6 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
              )}
            >
              {message.role === 'assistant' ? (
                <MeetingSummaryMarkdown markdown={message.content} />
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          ))
        )}
        {pending ? (
          <div className="mr-6 flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question about this meeting…"
          disabled={disabled || pending}
          className="min-h-[72px] flex-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)]"
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled || pending || !draft.trim()}
          className="h-9 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={send}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </section>
  );
}
