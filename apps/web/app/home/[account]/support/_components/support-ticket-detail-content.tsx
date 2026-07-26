'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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
import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type {
  TicketPriority,
  TicketStatus,
} from '../_lib/schema/support-tickets.schema';
import {
  addSupportTicketMessage,
  listSupportTeamMembers,
  updateSupportTicket,
} from '../_lib/server/server-actions';
import type {
  SupportTicket,
  TicketMessage,
} from '../_lib/server/support-tickets.service';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  formatTicketDate,
  formatTicketNumber,
} from './support-ticket-badges';

type TeamMemberOption = { userId: string; name: string };

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function SupportTicketDetailContent({
  ticket: initialTicket,
  initialMessages,
  accountId,
  accountSlug,
}: {
  ticket: SupportTicket;
  initialMessages: TicketMessage[];
  accountId: string;
  accountSlug: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [showInternal, setShowInternal] = useState(true);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<
    SupportAttachmentItem[]
  >([]);
  const [replyExternalUrl, setReplyExternalUrl] = useState('');

  const projectSupportHref =
    ticket.projectId && accountSlug
      ? pathsConfig.app.accountSupportProject
          .replace('[account]', accountSlug)
          .replace('[projectId]', ticket.projectId)
      : null;

  useEffect(() => {
    listSupportTeamMembers({ accountSlug })
      .then((rows) => setTeamMembers(rows ?? []))
      .catch(() => setTeamMembers([]));
  }, [accountSlug]);

  const visibleMessages = useMemo(
    () =>
      showInternal
        ? messages
        : messages.filter((message) => !message.isInternal),
    [messages, showInternal],
  );

  const listHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );

  const updateTicket = (patch: Parameters<typeof updateSupportTicket>[0]) => {
    startTransition(async () => {
      try {
        const updated = await updateSupportTicket(patch);
        setTicket(updated);
        router.refresh();
        toast.success('Ticket updated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update ticket',
        );
      }
    });
  };

  const handleReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      toast.error('Message is required');
      return;
    }

    startTransition(async () => {
      try {
        const message = await addSupportTicketMessage({
          accountId,
          accountSlug,
          ticketId: ticket.id,
          message: reply.trim(),
          is_internal: isInternal,
          attachments:
            replyAttachments.length > 0 ? replyAttachments : undefined,
          external_url: replyExternalUrl.trim() || null,
        });
        setMessages((current) => [...current, message]);
        setReply('');
        setIsInternal(false);
        setReplyAttachments([]);
        setReplyExternalUrl('');
        setTicket((current) => ({
          ...current,
          status:
            !isInternal && current.status === 'open'
              ? 'waiting'
              : current.status,
        }));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send message',
        );
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="space-y-4">
        <Link
          href={listHref}
          className="text-sm text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to support
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-[var(--workspace-shell-text)]/60">
                {formatTicketNumber(ticket.ticketNumber)}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--workspace-shell-text)]/60">
              {ticket.clientOrgName ? (
                <span>Client: {ticket.clientOrgName}</span>
              ) : null}
              {ticket.websiteName ? (
                <span>
                  Website: {ticket.websiteName}
                  {ticket.websiteDomain ? ` (${ticket.websiteDomain})` : ''}
                </span>
              ) : null}
              {ticket.projectId && ticket.projectName ? (
                <span>
                  Project:{' '}
                  {projectSupportHref ? (
                    <Link
                      href={projectSupportHref}
                      className="text-[var(--ozer-accent-muted)] hover:underline"
                    >
                      {ticket.projectName}
                    </Link>
                  ) : (
                    ticket.projectName
                  )}
                </span>
              ) : null}
              {ticket.recordingUrl ? (
                <a
                  href={ticket.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ozer-accent-muted)] hover:underline"
                >
                  Recording
                </a>
              ) : null}
              {ticket.externalUrl ? (
                <a
                  href={ticket.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ozer-accent-muted)] hover:underline"
                >
                  External link
                </a>
              ) : null}
              <span>
                Created by{' '}
                {ticket.submitterName?.trim() ||
                  ticket.createdByName?.trim() ||
                  'Client'}{' '}
                on {formatTicketDate(ticket.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || ticket.status === 'resolved'}
              onClick={() =>
                updateTicket({
                  accountId,
                  ticketId: ticket.id,
                  status: 'resolved',
                })
              }
            >
              Resolve
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || ticket.status === 'closed'}
              onClick={() =>
                updateTicket({
                  accountId,
                  ticketId: ticket.id,
                  status: 'closed',
                })
              }
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 rounded-[16px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <Label>Status</Label>
          <Select
            value={ticket.status}
            onValueChange={(value) =>
              updateTicket({
                accountId,
                ticketId: ticket.id,
                status: value as TicketStatus,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 rounded-[16px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <Label>Priority</Label>
          <Select
            value={ticket.priority}
            onValueChange={(value) =>
              updateTicket({
                accountId,
                ticketId: ticket.id,
                priority: value as TicketPriority,
              })
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

        <div className="space-y-2 rounded-[16px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <Label>Assign to</Label>
          <Select
            value={ticket.assignedTo ?? '__none__'}
            onValueChange={(value) =>
              updateTicket({
                accountId,
                ticketId: ticket.id,
                assigned_to: value === '__none__' ? null : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Conversation
          </h2>
          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/60">
            <Checkbox
              checked={showInternal}
              onCheckedChange={(checked) => setShowInternal(checked === true)}
            />
            Show internal notes
          </label>
        </div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
          {visibleMessages.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No messages yet.
            </p>
          ) : (
            visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-4 py-3 ${
                  message.isInternal
                    ? 'border-amber-500/20 bg-amber-500/10'
                    : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--workspace-shell-text)]/50">
                  <span className="font-medium text-[var(--workspace-shell-text)]/80">
                    {message.authorName ?? 'Team member'}
                  </span>
                  <span>{formatTicketDate(message.createdAt)}</span>
                  {message.isInternal ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
                      Internal
                    </span>
                  ) : null}
                </div>
                <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/80">
                  {message.message}
                </p>
                {message.externalUrl ? (
                  <a
                    href={message.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-[var(--ozer-accent-muted)] hover:underline"
                  >
                    External link
                  </a>
                ) : null}
                {message.attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {message.attachments.map((file) => (
                      <li key={file.url}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--ozer-accent-muted)] hover:underline"
                        >
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleReply}
          className="space-y-3 border-t border-[color:var(--workspace-shell-border)] px-4 py-4"
        >
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            placeholder="Write a reply…"
          />
          <div className="space-y-2">
            <Label htmlFor="reply-external-url">External link (optional)</Label>
            <Input
              id="reply-external-url"
              type="url"
              value={replyExternalUrl}
              onChange={(event) => setReplyExternalUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>
          <SupportAttachmentUploader
            accountId={accountId}
            value={replyAttachments}
            onChange={setReplyAttachments}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
              <Checkbox
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(checked === true)}
              />
              Internal note
            </label>
            <Button
              type="submit"
              disabled={isPending}
              className={workspaceBtnPrimaryMd}
            >
              {isPending ? 'Sending…' : 'Send reply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
