'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { LifeBuoy, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type {
  TicketPriority,
  TicketStatus,
} from '../_lib/schema/support-tickets.schema';
import type { SupportTicket } from '../_lib/server/support-tickets.service';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  formatTicketDate,
  formatTicketNumber,
} from './support-ticket-badges';

type StatusFilter = 'all' | TicketStatus;

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
];

const priorityOptions: { value: 'all' | TicketPriority; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function SupportTicketsPageContent({
  accountSlug,
  initialTickets,
}: {
  accountSlug: string;
  initialTickets: SupportTicket[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>(
    'all',
  );

  const filteredTickets = useMemo(() => {
    return initialTickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [initialTickets, statusFilter, priorityFilter]);

  const newHref = pathsConfig.app.accountSupportNew.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-6 px-4 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">
            Support
          </h1>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {filteredTickets.length}{' '}
            {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>

        <Button asChild className={workspaceBtnPrimaryMd}>
          <Link href={newHref}>
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3 sm:border-0 sm:pb-0">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]'
                    : 'text-[var(--workspace-shell-text)]/50 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <Select
          value={priorityFilter}
          onValueChange={(value) =>
            setPriorityFilter(value as 'all' | TicketPriority)
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Priority" />
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

      {filteredTickets.length === 0 ? (
        <Card className="rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LifeBuoy className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No support tickets yet
            </p>
            <p className="mt-1 max-w-md text-sm text-[var(--workspace-shell-text)]/50">
              Track client issues, assign team members, and keep conversations
              in one place.
            </p>
            <Button asChild className={`mt-4 ${workspaceBtnPrimaryMd}`}>
              <Link href={newHref}>
                <Plus className="h-4 w-4" />
                New ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Assigned to</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const detailHref = pathsConfig.app.accountSupportDetail
                    .replace('[account]', accountSlug)
                    .replace('[id]', ticket.id);

                  return (
                    <tr
                      key={ticket.id}
                      className="border-b border-[color:var(--workspace-shell-border)] last:border-0 hover:bg-[var(--workspace-shell-sidebar-accent)]"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--workspace-shell-text)]/70">
                        <Link
                          href={detailHref}
                          className="hover:text-[var(--ozer-accent-muted)]"
                        >
                          {formatTicketNumber(ticket.ticketNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
                        >
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                        {ticket.clientOrgName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <TicketStatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3">
                        <TicketPriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                        {ticket.assignedToName ?? 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                        {formatTicketDate(ticket.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
