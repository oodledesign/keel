'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ExternalLink, Loader2, Paperclip } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type { SupportAttachmentItem } from '~/components/support/support-attachment-uploader';
import { SupportMessageAttachments } from '~/components/support/support-message-attachments';
import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';
import {
  TicketStatusBadge,
  ticketStatusLabel,
} from '~/components/support/ticket-status-badge';

import { replyPublicSupportTicketAction } from '../../../_lib/public-support.actions';

type Message = {
  id: string;
  message: string;
  createdAt: string;
  authorName: string | null;
  attachments: SupportAttachmentItem[];
  externalUrl: string | null;
};

export function PublicSupportTicketThread({
  token,
  ticketNumber,
  title,
  status,
  projectName,
  recordingUrl,
  externalUrl,
  submitterName,
  submitterEmail,
  workspaceName,
  workspaceLogoUrl,
  clientName,
  clientPictureUrl,
  messages,
  closed,
}: {
  token: string;
  ticketNumber: number;
  title: string;
  status: string;
  projectName: string | null;
  recordingUrl: string | null;
  externalUrl: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  workspaceName?: string | null;
  workspaceLogoUrl?: string | null;
  clientName?: string | null;
  clientPictureUrl?: string | null;
  messages: Message[];
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState(submitterName ?? '');
  const [authorEmail, setAuthorEmail] = useState(submitterEmail ?? '');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - attachments.length)) {
        const body = new FormData();
        body.set('supportToken', token);
        body.set('file', file);
        const response = await fetch('/api/support/upload-attachment', {
          method: 'POST',
          body,
        });
        const json = (await response.json()) as {
          attachment?: SupportAttachmentItem;
          error?: string;
        };
        if (!response.ok || !json.attachment) {
          throw new Error(json.error ?? 'Upload failed');
        }
        setAttachments((current) => [...current, json.attachment!]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function sendReply() {
    startTransition(async () => {
      try {
        await replyPublicSupportTicketAction({
          token,
          message,
          authorName,
          authorEmail,
          attachments,
        });
        setMessage('');
        setAttachments([]);
        toast.success('Reply sent');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send reply',
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {workspaceName || clientName ? (
          <SupportDualPartyIdentity
            className="mb-4"
            size="sm"
            business={
              workspaceName
                ? { name: workspaceName, logoUrl: workspaceLogoUrl }
                : null
            }
            client={
              clientName
                ? { name: clientName, logoUrl: clientPictureUrl }
                : null
            }
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Ticket #{ticketNumber}
          </p>
          <TicketStatusBadge status={status || 'open'} />
          <span className="sr-only">Stage: {ticketStatusLabel(status)}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {projectName ? (
          <p className="mt-1 text-sm text-zinc-600">Project: {projectName}</p>
        ) : null}
        <p className="mt-3 text-sm text-amber-800">
          Bookmark this page — it&apos;s your private link to follow updates.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {recordingUrl ? (
            <a
              href={recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-700 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Recording
            </a>
          ) : null}
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-700 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Related link
            </a>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-800">
                {row.authorName ?? 'Support'}
              </span>
              <span>
                {new Date(row.createdAt).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-zinc-800">
              {row.message}
            </p>
            <SupportMessageAttachments attachments={row.attachments} />
            {row.externalUrl ? (
              <a
                href={row.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                External link
              </a>
            ) : null}
          </div>
        ))}
      </div>

      {!closed ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Reply</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reply-name">Your name</Label>
              <Input
                id="reply-name"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-email">Email</Label>
              <Input
                id="reply-email"
                type="email"
                value={authorEmail}
                onChange={(event) => setAuthorEmail(event.target.value)}
              />
            </div>
          </div>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="Add more detail…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || attachments.length >= 5}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,application/pdf';
                input.multiple = true;
                input.onchange = () => void uploadFiles(input.files);
                input.click();
              }}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="mr-2 h-4 w-4" />
              )}
              Attach
            </Button>
            {attachments.map((file) => (
              <span key={file.url} className="text-xs text-zinc-600">
                {file.name}
              </span>
            ))}
          </div>
          <Button
            type="button"
            disabled={pending || uploading || !message.trim()}
            onClick={sendReply}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              'Send reply'
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          This ticket is closed. Contact the team if you need it reopened.
        </p>
      )}
    </div>
  );
}
