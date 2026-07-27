'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
import { cn } from '@kit/ui/utils';

import {
  type SupportAttachmentItem,
  SupportAttachmentUploader,
} from '~/components/support/support-attachment-uploader';
import { SupportMessageAttachments } from '~/components/support/support-message-attachments';
import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';
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

function SidebarSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[16px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
        className,
      )}
    >
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          {title}
        </h2>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function MessageBubble({ message }: { message: TicketMessage }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        message.isInternal
          ? 'border-[color:var(--ozer-accent)]/20 bg-[color:var(--ozer-accent)]/8'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
        <span className="font-medium text-[var(--workspace-shell-text)]">
          {message.authorName?.trim() || 'Support'}
        </span>
        <span>{formatTicketDate(message.createdAt)}</span>
        {message.isInternal ? (
          <span className="rounded-full bg-[color:var(--ozer-accent)]/15 px-2 py-0.5 text-[color:var(--ozer-accent)]">
            Internal
          </span>
        ) : null}
      </div>
      <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/85">
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
      <SupportMessageAttachments attachments={message.attachments} />
    </div>
  );
}

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
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<
    SupportAttachmentItem[]
  >([]);
  const [replyExternalUrl, setReplyExternalUrl] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const projectSupportHref =
    ticket.projectId && accountSlug
      ? pathsConfig.app.accountSupportProject
          .replace('[account]', accountSlug)
          .replace('[projectId]', ticket.projectId)
      : null;

  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    listSupportTeamMembers({ accountSlug })
      .then((rows) => setTeamMembers(rows ?? []))
      .catch(() => setTeamMembers([]));
  }, [accountSlug]);

  const threadMessages = useMemo(
    () => messages.filter((message) => !message.isInternal),
    [messages],
  );

  const internalMessages = useMemo(
    () => messages.filter((message) => message.isInternal),
    [messages],
  );

  const listHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );

  const updateTicket = (patch: Parameters<typeof updateSupportTicket>[0]) => {
    void (async () => {
      setIsUpdatingTicket(true);
      try {
        const updated = await updateSupportTicket(patch);
        setTicket(updated);
        router.refresh();
        toast.success('Ticket updated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update ticket',
        );
      } finally {
        setIsUpdatingTicket(false);
      }
    })();
  };

  const sendMessage = async (input: {
    message: string;
    isInternal: boolean;
    attachments?: SupportAttachmentItem[];
    externalUrl?: string;
  }) => {
    const message = await addSupportTicketMessage({
      accountId,
      accountSlug,
      ticketId: ticket.id,
      message: input.message,
      is_internal: input.isInternal,
      attachments:
        input.attachments && input.attachments.length > 0
          ? input.attachments
          : undefined,
      external_url: input.externalUrl?.trim() || null,
    });

    setMessages((current) => [...current, message]);
    setTicket((current) => ({
      ...current,
      lastActivityAt: message.createdAt,
      status:
        !input.isInternal && current.status === 'open'
          ? 'waiting'
          : current.status,
    }));

    router.refresh();
    return message;
  };

  const handleReply = (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      toast.error('Message is required');
      return;
    }

    void (async () => {
      setIsReplying(true);
      try {
        await sendMessage({
          message: reply.trim(),
          isInternal: false,
          attachments: replyAttachments,
          externalUrl: replyExternalUrl,
        });
        setReply('');
        setReplyAttachments([]);
        setReplyExternalUrl('');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send message',
        );
      } finally {
        setIsReplying(false);
      }
    })();
  };

  const handleInternalNote = (event: FormEvent) => {
    event.preventDefault();
    if (!internalNote.trim()) {
      toast.error('Note is required');
      return;
    }

    void (async () => {
      setIsSavingNote(true);
      try {
        await sendMessage({
          message: internalNote.trim(),
          isInternal: true,
        });
        setInternalNote('');
        toast.success('Internal note added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add note',
        );
      } finally {
        setIsSavingNote(false);
      }
    })();
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 lg:px-0">
      <div className="space-y-4">
        <Link
          href={listHref}
          className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to support
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-[var(--workspace-shell-text-muted)]">
                {formatTicketNumber(ticket.ticketNumber)}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--workspace-shell-text)]">
              {ticket.title}
            </h1>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Created by{' '}
              {ticket.submitterName?.trim() ||
                ticket.createdByName?.trim() ||
                'Client'}{' '}
              on {formatTicketDate(ticket.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isUpdatingTicket || ticket.status === 'resolved'}
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
              disabled={isUpdatingTicket || ticket.status === 'closed'}
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Conversation — primary column */}
        <div className="flex h-[min(720px,calc(100vh-12rem))] min-h-[480px] flex-col overflow-hidden rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Conversation
            </h2>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Visible to the client
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {threadMessages.length === 0 ? (
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                No messages yet.
              </p>
            ) : (
              threadMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
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
              <Label htmlFor="reply-external-url">
                External link (optional)
              </Label>
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
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isReplying}
                className={workspaceBtnPrimaryMd}
              >
                {isReplying ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </form>
        </div>

        {/* Meta + internal notes — secondary column */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <SidebarSection title="Details">
            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
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
          </SidebarSection>

          <SidebarSection title="About">
            <dl className="space-y-3 text-sm">
              {ticket.clientOrgName || ticket.businessName ? (
                <div>
                  <dt className="mb-2 text-xs text-[var(--workspace-shell-text-muted)]">
                    Parties
                  </dt>
                  <dd>
                    <SupportDualPartyIdentity
                      layout="stack"
                      size="sm"
                      client={
                        ticket.clientOrgName
                          ? {
                              name: ticket.clientOrgName,
                              logoUrl: ticket.clientPictureUrl,
                            }
                          : null
                      }
                      business={
                        ticket.businessName
                          ? {
                              name: ticket.businessName,
                              logoUrl: ticket.businessLogoUrl,
                            }
                          : null
                      }
                    />
                  </dd>
                </div>
              ) : null}

              {ticket.submitterName || ticket.submitterEmail ? (
                <div>
                  <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Submitter
                  </dt>
                  <dd className="text-[var(--workspace-shell-text)]">
                    {ticket.submitterName?.trim() || 'Client'}
                    {ticket.submitterEmail ? (
                      <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                        {ticket.submitterEmail}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}

              {ticket.websiteName ? (
                <div>
                  <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Website
                  </dt>
                  <dd className="text-[var(--workspace-shell-text)]">
                    {ticket.websiteName}
                    {ticket.websiteDomain ? (
                      <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                        {ticket.websiteDomain}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}

              {ticket.projectId && ticket.projectName ? (
                <div>
                  <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Project
                  </dt>
                  <dd className="text-[var(--workspace-shell-text)]">
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
                  </dd>
                </div>
              ) : null}

              <div>
                <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Last activity
                </dt>
                <dd className="text-[var(--workspace-shell-text)]">
                  {formatTicketDate(
                    ticket.lastActivityAt ??
                      ticket.updatedAt ??
                      ticket.createdAt,
                  )}
                </dd>
              </div>

              {ticket.recordingUrl || ticket.externalUrl ? (
                <div className="flex flex-col gap-1.5 pt-1">
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
                </div>
              ) : null}
            </dl>
          </SidebarSection>

          <SidebarSection title="Internal notes">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Only visible to your team
            </p>

            <div className="max-h-56 space-y-2 overflow-y-auto">
              {internalMessages.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No internal notes yet.
                </p>
              ) : (
                internalMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            <form onSubmit={handleInternalNote} className="space-y-2 pt-1">
              <Textarea
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
                rows={3}
                placeholder="Add a private note…"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSavingNote}
                className="w-full"
              >
                {isSavingNote ? 'Saving…' : 'Add note'}
              </Button>
            </form>
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}
