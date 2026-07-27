'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { LayoutGrid, LayoutList, LifeBuoy, Plus, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import pathsConfig from '~/config/paths.config';
import { SupportPartyIdentity } from '~/components/support/support-party-identity';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type {
  TicketPriority,
  TicketStatus,
} from '../_lib/schema/support-tickets.schema';
import type { SupportTicket } from '../_lib/server/support-tickets.service';
import { SupportClientLinksPanel } from './support-client-links-panel';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  formatTicketDate,
  formatTicketNumber,
} from './support-ticket-badges';
import { SupportTicketsBoard } from './support-tickets-board';

type StatusFilter = 'all' | TicketStatus;
type ViewMode = 'list' | 'board';

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

const RECENT_MS = 24 * 60 * 60 * 1000;

function isRecentActivity(at: string | null | undefined) {
  if (!at) return false;
  return Date.now() - new Date(at).getTime() < RECENT_MS;
}

function formatLastActivity(at: string | null | undefined) {
  if (!at) return '—';
  return new Date(at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SupportTicketsPageContent({
  accountSlug,
  accountId,
  initialTickets,
  pageTitle = 'Support',
  pageDescription,
  backHref,
}: {
  accountSlug: string;
  accountId: string;
  initialTickets: SupportTicket[];
  pageTitle?: string;
  pageDescription?: string;
  backHref?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialTickets.filter((ticket) => {
      if (
        viewMode === 'list' &&
        statusFilter !== 'all' &&
        ticket.status !== statusFilter
      ) {
        return false;
      }
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          ticket.title,
          ticket.description ?? '',
          ticket.clientOrgName ?? '',
          ticket.submitterName ?? '',
          ticket.submitterEmail ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [initialTickets, statusFilter, priorityFilter, search, viewMode]);

  const newHref = pathsConfig.app.accountSupportNew.replace(
    '[account]',
    accountSlug,
  );

  const description =
    pageDescription ??
    `${filteredTickets.length} ${filteredTickets.length === 1 ? 'ticket' : 'tickets'}`;

  return (
    <div
      className={
        viewMode === 'board'
          ? 'flex h-[calc(100svh-3.5rem)] flex-col gap-4 overflow-hidden px-4 pb-4 lg:px-0'
          : 'space-y-6 px-4 lg:px-0'
      }
    >
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {backHref ? (
            <Link
              href={backHref}
              className="mb-2 inline-block text-sm text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)]"
            >
              ← Back to support
            </Link>
          ) : null}
          <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">
            {pageTitle}
          </h1>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {description}
          </p>
        </div>

        <Button asChild className={workspaceBtnPrimaryMd}>
          <Link href={newHref}>
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </Button>
      </div>

      {!backHref ? (
        <div className="shrink-0">
          <SupportClientLinksPanel
            accountId={accountId}
            accountSlug={accountSlug}
          />
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text)]/30" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${
                viewMode === 'list'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text)]/50'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${
                viewMode === 'board'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text)]/50'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
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
      </div>

      {viewMode === 'list' ? (
        <div className="flex flex-wrap gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3">
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
      ) : null}

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
      ) : viewMode === 'board' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SupportTicketsBoard
            key={filteredTickets.map((t) => t.id).join(',')}
            accountSlug={accountSlug}
            accountId={accountId}
            tickets={filteredTickets}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Submitted by</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Assigned to</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const detailHref = pathsConfig.app.accountSupportDetail
                    .replace('[account]', accountSlug)
                    .replace('[id]', ticket.id);
                  const recent = isRecentActivity(ticket.lastActivityAt);

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
                        <div className="space-y-0.5">
                          <div>
                            {ticket.submitterName?.trim() ||
                              ticket.createdByName?.trim() ||
                              '—'}
                          </div>
                          {ticket.submitterEmail ? (
                            <div className="text-xs text-[var(--workspace-shell-text)]/45">
                              {ticket.submitterEmail}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                        {ticket.clientOrgName || ticket.businessName ? (
                          <div className="space-y-1.5">
                            {ticket.clientOrgName ? (
                              <SupportPartyIdentity
                                party={{
                                  name: ticket.clientOrgName,
                                  logoUrl: ticket.clientPictureUrl,
                                }}
                                size="sm"
                                nameClassName="text-sm text-[var(--workspace-shell-text)]/80"
                              />
                            ) : null}
                            {ticket.businessName ? (
                              <SupportPartyIdentity
                                party={{
                                  name: ticket.businessName,
                                  logoUrl: ticket.businessLogoUrl,
                                }}
                                size="sm"
                                nameClassName="text-xs text-[var(--workspace-shell-text)]/55"
                              />
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
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
                        <span className="inline-flex items-center gap-2">
                          {recent ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[var(--ozer-accent-muted)]"
                              title="Activity in the last 24 hours"
                            />
                          ) : null}
                          {formatLastActivity(ticket.lastActivityAt)}
                        </span>
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
