'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { PageBody, PageHeader } from '@kit/ui/page';
import { toast } from '@kit/ui/sonner';

import type { PlatformSupportTicketDetail } from '~/lib/support/load-platform-support-ticket';
import {
  adminReplyPlatformSupportTicketAction,
  adminUpdatePlatformSupportTicketAction,
} from '~/lib/support/platform-support.actions';
import {
  PLATFORM_SUPPORT_PRIORITIES,
  PLATFORM_SUPPORT_STATUSES,
  type PlatformSupportTicketPriority,
  type PlatformSupportTicketStatus,
} from '~/lib/support/platform-support.types';

import {
  PlatformSupportReplyForm,
  PlatformSupportTicketThread,
} from '~/home/(user)/support/_components/platform-support-ticket-detail';

export function AdminPlatformSupportTicketDetail(props: {
  ticket: PlatformSupportTicketDetail;
}) {
  const [pending, startTransition] = useTransition();
  const ticket = props.ticket;

  return (
    <>
      <PageHeader
        title="Platform support"
        description={
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/admin/support">← All tickets</Link>
          </Button>
        }
      />
      <PageBody className="mx-auto max-w-3xl space-y-8 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{ticket.userEmail ?? ticket.userId}</Badge>
          {ticket.accountName ? (
            <Badge variant="outline">Workspace: {ticket.accountName}</Badge>
          ) : null}
        </div>

        <PlatformSupportTicketThread
          ticketNumber={ticket.ticketNumber}
          subject={ticket.subject}
          openingBody={ticket.body}
          createdAt={ticket.createdAt}
          status={ticket.status}
          messages={ticket.messages}
          userEmail={ticket.userEmail}
          accountName={ticket.accountName}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatusSelect ticketId={ticket.id} value={ticket.status} />
          <PrioritySelect
            ticketId={ticket.id}
            status={ticket.status}
            value={ticket.priority}
          />
        </div>

        <PlatformSupportReplyForm
          ticketId={ticket.id}
          placeholder="Reply to the user…"
          allowInternalNote
          onSubmit={adminReplyPlatformSupportTicketAction}
        />

        <form
          className="space-y-2 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const notes = new FormData(e.currentTarget).get('notes');
            startTransition(async () => {
              try {
                await adminUpdatePlatformSupportTicketAction({
                  ticketId: ticket.id,
                  status: ticket.status as PlatformSupportTicketStatus,
                  adminNotes: String(notes ?? ''),
                });
                toast.success('Internal notes saved');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Save failed');
              }
            });
          }}
        >
          <p className="text-sm font-medium">Internal notes</p>
          <textarea
            name="notes"
            defaultValue={ticket.adminNotes ?? ''}
            className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Save notes
          </Button>
        </form>
      </PageBody>
    </>
  );
}

function StatusSelect(props: { ticketId: string; value: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={props.value}
      disabled={pending}
      onValueChange={(status) => {
        startTransition(async () => {
          try {
            await adminUpdatePlatformSupportTicketAction({
              ticketId: props.ticketId,
              status: status as PlatformSupportTicketStatus,
            });
            toast.success('Status updated');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Update failed');
          }
        });
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {PLATFORM_SUPPORT_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">
            {s.replace('_', ' ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PrioritySelect(props: {
  ticketId: string;
  status: string;
  value: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={props.value}
      disabled={pending}
      onValueChange={(priority) => {
        startTransition(async () => {
          try {
            await adminUpdatePlatformSupportTicketAction({
              ticketId: props.ticketId,
              status: props.status as PlatformSupportTicketStatus,
              priority: priority as PlatformSupportTicketPriority,
            });
            toast.success('Priority updated');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Update failed');
          }
        });
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        {PLATFORM_SUPPORT_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p} className="capitalize">
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
