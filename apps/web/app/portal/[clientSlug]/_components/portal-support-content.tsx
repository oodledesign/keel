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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import type {
  PortalTicketDetail,
  PortalTicketMessage,
} from '../_lib/server/client-portal.service';
import type { PortalTicketPriority } from '../_lib/schema/portal.schema';
import { addPortalTicketMessage, createPortalTicket } from '../_lib/server/server-actions';
import {
  PortalTicketPriorityBadge,
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalTicketNumber,
} from './portal-badges';

export function PortalSupportDetailContent({
  ticket: initialTicket,
  initialMessages,
  clientOrgId,
  clientSlug,
}: {
  ticket: PortalTicketDetail;
  initialMessages: PortalTicketMessage[];
  clientOrgId: string;
  clientSlug: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ticket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState('');

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );

  const handleReply = (event: React.FormEvent) => {
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
          message: reply.trim(),
        });
        setMessages((current) => [...current, message]);
        setReply('');
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
      <Link href={listHref} className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to support
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-slate-500">
            {formatPortalTicketNumber(ticket.ticketNumber)}
          </span>
          <PortalTicketStatusBadge status={ticket.status} />
          <PortalTicketPriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{ticket.title}</h1>
        <p className="text-sm text-slate-500">
          Opened {formatPortalDate(ticket.createdAt)}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
        </div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {message.authorName ?? 'Team member'}
                  </span>
                  <span>{formatPortalDate(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {message.message}
                </p>
              </div>
            ))
          )}
        </div>

        {ticket.status !== 'closed' ? (
          <form
            onSubmit={handleReply}
            className="space-y-3 border-t border-slate-200 px-4 py-4"
          >
            <Label htmlFor="reply">Reply</Label>
            <Textarea
              id="reply"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={4}
              placeholder="Write your message…"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t border-slate-200 px-4 py-4 text-sm text-slate-500">
            This ticket is closed. Open a new ticket if you need further help.
          </div>
        )}
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
  clientSlug,
}: {
  clientOrgId: string;
  accountId: string;
  clientSlug: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as PortalTicketPriority,
  });

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
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
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
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
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
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
