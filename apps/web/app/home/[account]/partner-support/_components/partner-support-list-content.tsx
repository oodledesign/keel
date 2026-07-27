'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { LifeBuoy, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { SupportPartyIdentity } from '~/components/support/support-party-identity';
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
import type { PartnerTicket } from '~/lib/support/partner-support.service';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

type StatusFilter = 'all' | TicketStatus;

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function PartnerSupportListContent({
  accountSlug,
  initialTickets,
}: {
  accountSlug: string;
  initialTickets: PartnerTicket[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return initialTickets;
    return initialTickets.filter((ticket) => ticket.status === statusFilter);
  }, [initialTickets, statusFilter]);

  const newHref = pathsConfig.app.accountPartnerSupportNew.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {filteredTickets.length}{' '}
            {filteredTickets.length === 1 ? 'ticket' : 'tickets'} with linked
            agencies
          </p>
        </div>

        <Button asChild className={workspaceBtnPrimaryMd}>
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
                  ? 'bg-[var(--workspace-shell-accent)]/20 text-[var(--workspace-shell-accent)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-surface)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredTickets.length === 0 ? (
        <Card className="border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-surface)]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LifeBuoy className="mb-4 h-12 w-12 text-[var(--workspace-shell-text-muted)]" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No partner support tickets yet
            </p>
            <p className="mt-1 max-w-md text-sm text-[var(--workspace-shell-text-muted)]">
              Raise a ticket and your agency team will get back to you here.
            </p>
            <Button asChild className={`mt-4 ${workspaceBtnPrimaryMd}`}>
              <Link href={newHref}>
                <Plus className="h-4 w-4" />
                Raise a ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Agency</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const detailHref = pathsConfig.app.accountPartnerSupportDetail
                    .replace('[account]', accountSlug)
                    .replace('[id]', ticket.id);

                  return (
                    <tr
                      key={ticket.id}
                      className="border-b border-[var(--workspace-shell-border)] last:border-0 hover:bg-[var(--workspace-shell-canvas)]/60"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--workspace-shell-text-muted)]">
                        <Link href={detailHref} className="hover:underline">
                          {formatTicketNumber(ticket.ticketNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="font-medium text-[var(--workspace-shell-text)] hover:underline"
                        >
                          {ticket.title}
                        </Link>
                        <p className="mt-1">
                          <SupportPartyIdentity
                            party={{
                              name: ticket.clientOrgName,
                              logoUrl: ticket.clientPictureUrl,
                            }}
                            size="sm"
                            nameClassName="text-xs text-[var(--workspace-shell-text-muted)]"
                          />
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                        <SupportPartyIdentity
                          party={{
                            name: ticket.providerAccountName,
                            logoUrl: ticket.providerAccountLogoUrl,
                          }}
                          size="sm"
                          nameClassName="text-sm text-[var(--workspace-shell-text-muted)]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <TicketStatusBadge
                          status={ticket.status as TicketStatus}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <TicketPriorityBadge
                          priority={ticket.priority as TicketPriority}
                        />
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
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
