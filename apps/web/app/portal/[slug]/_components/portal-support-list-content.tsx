'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { LifeBuoy, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import type { PortalTicketStatus } from '../_lib/schema/portal.schema';
import type { PortalTicket } from '../_lib/server/client-portal.service';
import {
  PortalTicketPriorityBadge,
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalTicketNumber,
} from './portal-badges';

type StatusFilter = 'all' | PortalTicketStatus;

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function PortalSupportListContent({
  clientSlug,
  initialTickets,
}: {
  clientSlug: string;
  initialTickets: PortalTicket[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return initialTickets;
    return initialTickets.filter((ticket) => ticket.status === statusFilter);
  }, [initialTickets, statusFilter]);

  const newHref = pathsConfig.app.clientPortalSupportNew.replace(
    '[clientSlug]',
    clientSlug,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--ozer-text-on-light)]">
            Support
          </h2>
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            {filteredTickets.length}{' '}
            {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>

        <Button asChild>
          <Link href={newHref}>
            <Plus className="h-4 w-4" />
            Raise a ticket
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--ozer-accent-subtle)] text-[#1d6f65]'
                  : 'text-[var(--ozer-text-on-light-muted)] hover:bg-slate-100 hover:text-[var(--ozer-text-on-light)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LifeBuoy className="mb-4 h-12 w-12 text-[var(--workspace-shell-text-muted)]" />
            <p className="font-medium text-[var(--ozer-text-on-light)]">
              No support tickets yet
            </p>
            <p className="mt-1 max-w-md text-sm text-[var(--ozer-text-on-light-muted)]">
              Need help? Raise a ticket and our team will get back to you.
            </p>
            <Button asChild className="mt-4">
              <Link href={newHref}>
                <Plus className="h-4 w-4" />
                Raise a ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const detailHref = pathsConfig.app.clientPortalSupportDetail
                    .replace('[clientSlug]', clientSlug)
                    .replace('[id]', ticket.id);

                  return (
                    <tr
                      key={ticket.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        <Link
                          href={detailHref}
                          className="hover:text-[var(--ozer-accent)]"
                        >
                          {formatPortalTicketNumber(ticket.ticketNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="font-medium text-[var(--ozer-text-on-light)] hover:text-[var(--ozer-accent)]"
                        >
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <PortalTicketStatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PortalTicketPriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatPortalDate(ticket.createdAt)}
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
