'use client';

import { useTransition } from 'react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import type { PlatformSupportMessage } from '~/lib/support/load-platform-support-ticket';
import { formatPlatformTicketNumber } from '~/lib/support/platform-support.types';

export function PlatformSupportTicketThread(props: {
  ticketNumber: number;
  subject: string;
  openingBody: string;
  createdAt: string;
  status: string;
  messages: PlatformSupportMessage[];
  userEmail?: string | null;
  accountName?: string | null;
}) {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono text-sm">
            {formatPlatformTicketNumber(props.ticketNumber)}
          </span>
          <Badge variant="outline" className="capitalize">
            {props.status.replace('_', ' ')}
          </Badge>
        </div>
        <h1 className="text-xl font-semibold">{props.subject}</h1>
        {props.accountName ? (
          <p className="text-muted-foreground text-sm">
            Workspace: {props.accountName}
          </p>
        ) : null}
      </header>

      <div className="space-y-3">
        <MessageBubble
          author={props.userEmail ?? 'You'}
          createdAt={props.createdAt}
          body={props.openingBody}
        />
        {props.messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={
              message.isInternalNote
                ? `${message.authorEmail ?? 'Admin'} (internal)`
                : (message.authorEmail ?? 'Support')
            }
            createdAt={message.createdAt}
            body={message.body}
            muted={message.isInternalNote}
          />
        ))}
      </div>
    </div>
  );
}

function MessageBubble(props: {
  author: string;
  createdAt: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <article
      className={
        props.muted
          ? 'bg-muted/40 rounded-lg border border-dashed p-4'
          : 'rounded-lg border p-4'
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{props.author}</span>
        <time className="text-muted-foreground">
          {new Date(props.createdAt).toLocaleString('en-GB')}
        </time>
      </div>
      <p className="whitespace-pre-wrap text-sm">{props.body}</p>
    </article>
  );
}

export function PlatformSupportReplyForm(props: {
  ticketId: string;
  placeholder?: string;
  onSubmit: (input: {
    ticketId: string;
    body: string;
    isInternalNote?: boolean;
  }) => Promise<void>;
  allowInternalNote?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const body = String(form.get('body') ?? '').trim();
        const isInternalNote = form.get('internal') === 'on';

        if (!body) return;

        startTransition(async () => {
          try {
            await props.onSubmit({
              ticketId: props.ticketId,
              body,
              isInternalNote: props.allowInternalNote ? isInternalNote : false,
            });
            e.currentTarget.reset();
            toast.success('Reply sent');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send');
          }
        });
      }}
    >
      <Textarea
        name="body"
        required
        rows={4}
        placeholder={props.placeholder ?? 'Write a reply…'}
      />
      {props.allowInternalNote ? (
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input type="checkbox" name="internal" className="rounded border" />
          Internal note (not emailed to user)
        </label>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  );
}
