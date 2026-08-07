'use client';

import { useEffect, useState, useTransition } from 'react';

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

import { SupportAttachmentUploader } from '~/components/support/support-attachment-uploader';
import type { SupportAttachmentItem } from '~/components/support/support-attachment-uploader';
import { SupportMessageAttachments } from '~/components/support/support-message-attachments';
import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';
import pathsConfig from '~/config/paths.config';

import type { PortalTicketPriority } from '../_lib/schema/portal.schema';
import type {
  PortalTicketDetail,
  PortalTicketMessage,
} from '../_lib/server/client-portal.service';
import {
  addPortalTicketMessage,
  createPortalTicket,
  listPortalProjects,
  listPortalRequestTypes,
} from '../_lib/server/server-actions';
import {
  PortalTicketPriorityBadge,
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalTicketNumber,
} from './portal-badges';

type ProjectOption = { id: string; name: string };

export function PortalSupportDetailContent({
  ticket: initialTicket,
  initialMessages,
  clientOrgId,
  clientSlug,
  accountId,
  accountSlug,
  clientName,
  clientPictureUrl,
  businessName,
  businessLogoUrl,
}: {
  ticket: PortalTicketDetail;
  initialMessages: PortalTicketMessage[];
  clientOrgId: string;
  clientSlug: string;
  accountId: string;
  accountSlug: string;
  clientName?: string | null;
  clientPictureUrl?: string | null;
  businessName?: string | null;
  businessLogoUrl?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [externalUrl, setExternalUrl] = useState('');

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );

  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
  const needsCredits = ticket.status === 'pending_credits';

  const handleReply = (event: React.FormEvent, reopen = false) => {
    event.preventDefault();
    if (!reply.trim()) {
      toast.error('Message is required');
      return;
    }

    startTransition(async () => {
      try {
        const message = await addPortalTicketMessage({
          clientOrgId,
          ticketId: ticket.id,
          accountId,
          accountSlug,
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
        className="text-sm text-[var(--ozer-text-on-light-muted)] hover:text-[var(--ozer-text-on-light)]"
      >
        ← Back to support
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-[var(--ozer-text-on-light-muted)]">
            {formatPortalTicketNumber(ticket.ticketNumber)}
          </span>
          <PortalTicketStatusBadge status={ticket.status} />
          <PortalTicketPriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          {ticket.title}
        </h1>
        {(businessName || clientName) && (
          <SupportDualPartyIdentity
            className="mt-3"
            size="sm"
            business={
              businessName
                ? { name: businessName, logoUrl: businessLogoUrl }
                : null
            }
            client={
              clientName
                ? { name: clientName, logoUrl: clientPictureUrl }
                : null
            }
          />
        )}
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          Opened {formatPortalDate(ticket.createdAt)}
        </p>
      </div>

      {needsCredits ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          This request is waiting on credits before work can start.{' '}
          <Link href={creditsHref} className="font-medium underline">
            Top up credits
          </Link>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
            Conversation
          </h2>
        </div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              No messages yet.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ozer-text-on-light-muted)]">
                  <span className="font-medium text-[var(--ozer-text-on-light-muted)]">
                    {message.authorName?.trim() || 'Support'}
                  </span>
                  <span>{formatPortalDate(message.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-slate-800">
                  {message.message}
                </p>
                <SupportMessageAttachments attachments={message.attachments} />
                {message.externalUrl ? (
                  <a
                    href={message.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs text-[var(--ozer-accent)] underline"
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
          className="space-y-3 border-t border-slate-200 px-4 py-4"
        >
          <Label htmlFor="reply">
            {isClosed ? 'Reopen with a reply' : 'Reply'}
          </Label>
          <Textarea
            id="reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            placeholder="Write your message…"
          />
          <div className="space-y-2">
            <Label htmlFor="portal-reply-link">Link (optional)</Label>
            <Input
              id="portal-reply-link"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="https://"
            />
          </div>
          <SupportAttachmentUploader
            accountId={accountId}
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
            <Button type="submit" disabled={isPending}>
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

const priorityOptions: { value: PortalTicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function PortalSupportNewForm({
  clientOrgId,
  accountId,
  accountSlug,
  clientSlug,
  initialBalance = 0,
  initialRequestTypes = [],
}: {
  clientOrgId: string;
  accountId: string;
  accountSlug: string;
  clientSlug: string;
  initialBalance?: number;
  initialRequestTypes?: Array<{
    id: string;
    label: string;
    creditCost: number;
    isBillable: boolean;
    categoryGroup: string | null;
  }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [requestTypes, setRequestTypes] = useState(initialRequestTypes);
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as PortalTicketPriority,
    project_id: '',
    request_type_id: '',
    recording_url: '',
    external_url: '',
  });

  useEffect(() => {
    listPortalProjects({ clientOrgId, accountId })
      .then((rows) => setProjects(rows ?? []))
      .catch(() => setProjects([]));
  }, [accountId, clientOrgId]);

  useEffect(() => {
    if (initialRequestTypes.length > 0) return;
    listPortalRequestTypes({ clientOrgId })
      .then((rows) => setRequestTypes(rows ?? []))
      .catch(() => setRequestTypes([]));
  }, [clientOrgId, initialRequestTypes.length]);

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  const selectedType = requestTypes.find(
    (row) => row.id === form.request_type_id,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createPortalTicket({
          clientOrgId,
          accountId,
          accountSlug,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          project_id: form.project_id || null,
          request_type_id: form.request_type_id || null,
          recording_url: form.recording_url.trim() || null,
          external_url: form.external_url.trim() || null,
          attachments,
        });

        router.push(
          pathsConfig.app.clientPortalSupportDetail
            .replace('[clientSlug]', clientSlug)
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-[var(--ozer-text-on-light-muted)]">
          Credit balance:{' '}
          <span className="font-semibold text-[var(--ozer-text-on-light)]">
            {initialBalance}
          </span>
        </span>
        <Link
          href={creditsHref}
          className="font-medium text-[var(--ozer-text-on-light)] underline"
        >
          View credits
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        {requestTypes.length > 0 ? (
          <div className="space-y-2">
            <Label>Request type</Label>
            <Select
              value={form.request_type_id || undefined}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, request_type_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a request type" />
              </SelectTrigger>
              <SelectContent>
                {requestTypes.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                    {row.isBillable ? ` · ${row.creditCost} credits` : ' · free'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType ? (
              <p className="text-xs text-[var(--ozer-text-on-light-muted)]">
                {selectedType.isBillable
                  ? `This request costs ${selectedType.creditCost} credit${selectedType.creditCost === 1 ? '' : 's'} when work starts.`
                  : 'This request type is not billable.'}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Brief summary of the issue"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            rows={6}
            placeholder="Describe the issue in detail"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  priority: value as PortalTicketPriority,
                }))
              }
            >
              <SelectTrigger>
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
            <Label>Project (optional)</Label>
            <Select
              value={form.project_id || '__none__'}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  project_id: value === '__none__' ? '' : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recording_url">Recording URL (optional)</Label>
          <Input
            id="recording_url"
            value={form.recording_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recording_url: event.target.value,
              }))
            }
            placeholder="https://loom.com/…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="external_url">External link (optional)</Label>
          <Input
            id="external_url"
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

        <SupportAttachmentUploader
          accountId={accountId}
          value={attachments}
          onChange={setAttachments}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit ticket'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={listHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
