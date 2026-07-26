'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  type SupportAttachmentItem,
  SupportAttachmentUploader,
} from '~/components/support/support-attachment-uploader';
import { SupportMessageAttachments } from '~/components/support/support-message-attachments';
import pathsConfig from '~/config/paths.config';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  formatTicketDate,
  formatTicketNumber,
} from '~/home/[account]/support/_components/support-ticket-badges';
import type {
  TicketPriority,
  TicketStatus,
} from '~/home/[account]/support/_lib/schema/support-tickets.schema';
import type {
  PartnerLinkedOrg,
  PartnerTicketDetail,
  PartnerTicketMessage,
} from '~/lib/support/partner-support.service';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  addPartnerTicketReplyAction,
  createPartnerTicketAction,
} from '../_lib/partner-support.actions';

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function PartnerSupportDetailContent({
  linkedAccountId,
  accountSlug,
  ticket: initialTicket,
  initialMessages,
}: {
  linkedAccountId: string;
  accountSlug: string;
  ticket: PartnerTicketDetail;
  initialMessages: PartnerTicketMessage[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [externalUrl, setExternalUrl] = useState('');

  const listHref = pathsConfig.app.accountPartnerSupport.replace(
    '[account]',
    accountSlug,
  );

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  const handleReply = (event: React.FormEvent, reopen = false) => {
    event.preventDefault();
    if (!reply.trim()) {
      toast.error('Message is required');
      return;
    }

    startTransition(async () => {
      try {
        const message = await addPartnerTicketReplyAction({
          linkedAccountId,
          ticketId: ticket.id,
          message: reply.trim(),
          attachments,
          external_url: externalUrl.trim() || null,
          reopen: reopen || isClosed,
        });
        setMessages((current) => [...current, message]);
        setReply('');
        setAttachments([]);
        setExternalUrl('');
        if (reopen || isClosed) {
          setTicket((current) => ({ ...current, status: 'open' }));
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send message',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={listHref}
        className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
      >
        ← Back to partner support
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-[var(--workspace-shell-text-muted)]">
            {formatTicketNumber(ticket.ticketNumber)}
          </span>
          <TicketStatusBadge status={ticket.status as TicketStatus} />
          <TicketPriorityBadge priority={ticket.priority as TicketPriority} />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
          {ticket.title}
        </h1>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {ticket.providerAccountName} · Opened{' '}
          {formatTicketDate(ticket.createdAt)}
        </p>
        {ticket.description ? (
          <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/90">
            {ticket.description}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-surface)]">
        <div className="border-b border-[var(--workspace-shell-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Conversation
          </h2>
        </div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No messages yet.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <span className="font-medium">
                    {message.authorName?.trim() || 'Support'}
                  </span>
                  <span>{formatTicketDate(message.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                  {message.message}
                </p>
                <SupportMessageAttachments attachments={message.attachments} />
                {message.externalUrl ? (
                  <a
                    href={message.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs text-[var(--workspace-shell-accent)] underline"
                  >
                    External link
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(event) => handleReply(event)}
          className="space-y-3 border-t border-[var(--workspace-shell-border)] px-4 py-4"
        >
          <Label htmlFor="partner-reply">
            {isClosed ? 'Reopen with a reply' : 'Reply'}
          </Label>
          <Textarea
            id="partner-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            placeholder="Write your message…"
          />
          <div className="space-y-2">
            <Label htmlFor="partner-reply-link">Link (optional)</Label>
            <Input
              id="partner-reply-link"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="https://"
            />
          </div>
          <SupportAttachmentUploader
            accountId={ticket.providerAccountId}
            value={attachments}
            onChange={setAttachments}
          />
          <div className="flex justify-end gap-2">
            {isClosed ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={(event) => handleReply(event, true)}
              >
                Reopen ticket
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={isPending}
              className={workspaceBtnPrimaryMd}
            >
              {isPending
                ? 'Sending…'
                : isClosed
                  ? 'Reopen & send'
                  : 'Send reply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PartnerSupportNewForm({
  linkedAccountId,
  accountSlug,
  orgs,
}: {
  linkedAccountId: string;
  accountSlug: string;
  orgs: PartnerLinkedOrg[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [form, setForm] = useState({
    clientOrgId: orgs[0]?.clientOrgId ?? '',
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    recording_url: '',
    external_url: '',
  });

  const selectedOrg =
    orgs.find((org) => org.clientOrgId === form.clientOrgId) ?? orgs[0];

  const listHref = pathsConfig.app.accountPartnerSupport.replace(
    '[account]',
    accountSlug,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.clientOrgId || !form.title.trim() || !form.description.trim()) {
      toast.error('Agency, title, and description are required');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createPartnerTicketAction({
          linkedAccountId,
          clientOrgId: form.clientOrgId,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          recording_url: form.recording_url.trim() || null,
          external_url: form.external_url.trim() || null,
          attachments,
        });

        router.push(
          pathsConfig.app.accountPartnerSupportDetail
            .replace('[account]', accountSlug)
            .replace('[id]', created.id),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create ticket',
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-surface)] p-5 md:p-6">
        {orgs.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="partner-org">Agency</Label>
            <Select
              value={form.clientOrgId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, clientOrgId: value }))
              }
            >
              <SelectTrigger id="partner-org">
                <SelectValue placeholder="Select agency" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.clientOrgId} value={org.clientOrgId}>
                    {org.providerAccountName} ({org.clientOrgName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : selectedOrg ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Sending to{' '}
            <span className="font-medium text-[var(--workspace-shell-text)]">
              {selectedOrg.providerAccountName}
            </span>
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="partner-title">Title</Label>
          <Input
            id="partner-title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Brief summary of the issue"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partner-description">Description</Label>
          <Textarea
            id="partner-description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            rows={6}
            placeholder="What do you need help with?"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partner-priority">Priority</Label>
          <Select
            value={form.priority}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                priority: value as TicketPriority,
              }))
            }
          >
            <SelectTrigger id="partner-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="partner-external">Link (optional)</Label>
          <Input
            id="partner-external"
            value={form.external_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                external_url: event.target.value,
              }))
            }
            placeholder="https://"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partner-recording">Recording URL (optional)</Label>
          <Input
            id="partner-recording"
            value={form.recording_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recording_url: event.target.value,
              }))
            }
            placeholder="https://"
          />
        </div>

        {selectedOrg ? (
          <SupportAttachmentUploader
            accountId={selectedOrg.providerAccountId}
            value={attachments}
            onChange={setAttachments}
          />
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={listHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={isPending || !form.clientOrgId}
          className={workspaceBtnPrimaryMd}
        >
          {isPending ? 'Submitting…' : 'Submit ticket'}
        </Button>
      </div>
    </form>
  );
}
