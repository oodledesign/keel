'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  type SupportAttachmentItem,
  SupportAttachmentUploader,
} from '~/components/support/support-attachment-uploader';
import type { PlatformSupportMessage } from '~/lib/support/load-platform-support-ticket';
import {
  formatPlatformSupportCategory,
  formatPlatformTicketNumber,
} from '~/lib/support/platform-support.types';
import type { SupportAttachmentMeta } from '~/lib/support/support-attachment.types';

export function PlatformSupportTicketThread(props: {
  ticketNumber: number;
  subject: string;
  openingBody: string;
  createdAt: string;
  status: string;
  category?: string | null;
  attachments?: SupportAttachmentMeta[];
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
          {props.category ? (
            <Badge variant="secondary">
              {formatPlatformSupportCategory(props.category)}
            </Badge>
          ) : null}
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
          attachments={props.attachments}
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
            attachments={message.attachments}
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
  attachments?: SupportAttachmentMeta[];
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
      <p className="text-sm whitespace-pre-wrap">{props.body}</p>
      {props.attachments?.length ? (
        <ul className="mt-3 space-y-2">
          {props.attachments.map((file) => (
            <li key={file.url}>
              {file.mimeType.startsWith('image/') ? (
                <a href={file.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-h-64 max-w-full rounded-md border object-contain"
                  />
                </a>
              ) : (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline"
                >
                  {file.name}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
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
    attachments?: SupportAttachmentItem[];
  }) => Promise<unknown>;
  allowInternalNote?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = body.trim();
        const isInternalNote =
          props.allowInternalNote &&
          new FormData(e.currentTarget).get('internal') === 'on';

        if (!trimmed) return;

        startTransition(async () => {
          try {
            await props.onSubmit({
              ticketId: props.ticketId,
              body: trimmed,
              isInternalNote: props.allowInternalNote ? isInternalNote : false,
              attachments,
            });
            setBody('');
            setAttachments([]);
            toast.success('Reply sent');
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send');
          }
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        required
        rows={4}
        placeholder={props.placeholder ?? 'Write a reply…'}
      />
      <SupportAttachmentUploader
        platformSupport
        value={attachments}
        onChange={setAttachments}
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
