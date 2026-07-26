'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { LifeBuoy, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Skeleton } from '@kit/ui/skeleton';

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
import { listSupportTickets } from '~/home/[account]/support/_lib/server/server-actions';
import type { SupportTicket } from '~/home/[account]/support/_lib/server/support-tickets.service';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { ClientSupportLinkCard } from './client-support-link-card';
import { ClientWorkspaceSharesCard } from './client-workspace-shares-card';

export function ClientSupportBlock({
  accountSlug,
  accountId,
  clientOrgId,
  clientId = null,
  canManageLinks,
}: {
  accountSlug: string;
  accountId: string;
  clientOrgId: string | null;
  clientId?: string | null;
  canManageLinks: boolean;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(Boolean(clientOrgId));

  const loadTickets = useCallback(async () => {
    if (!clientOrgId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await listSupportTickets({
        accountId,
        clientOrgId,
      });
      setTickets(rows ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientOrgId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const newHref = clientOrgId
    ? `${pathsConfig.app.accountSupportNew.replace('[account]', accountSlug)}?clientOrgId=${clientOrgId}`
    : pathsConfig.app.accountSupportNew.replace('[account]', accountSlug);

  const supportListHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Support tickets
          </h3>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {clientOrgId
              ? `${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'} for this client`
              : 'Linking this client for support…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={supportListHref}>All support</Link>
          </Button>
          <Button asChild size="sm" className={workspaceBtnPrimaryMd}>
            <Link href={newHref}>
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </Button>
        </div>
      </div>

      {canManageLinks && clientOrgId ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <ClientSupportLinkCard
            accountId={accountId}
            clientOrgId={clientOrgId}
            accountSlug={accountSlug}
          />
          <ClientWorkspaceSharesCard
            accountId={accountId}
            clientOrgId={clientOrgId}
            clientId={clientId}
            accountSlug={accountSlug}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg bg-[var(--workspace-control-surface)]" />
          <Skeleton className="h-12 w-full rounded-lg bg-[var(--workspace-control-surface)]" />
        </div>
      ) : !clientOrgId ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-10 text-center">
          <LifeBuoy className="mx-auto mb-3 h-10 w-10 text-[var(--workspace-shell-text-muted)]" />
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Could not resolve support for this client yet.
          </p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-10 text-center">
          <LifeBuoy className="mx-auto mb-3 h-10 w-10 text-[var(--workspace-shell-text-muted)]" />
          <p className="font-medium text-[var(--workspace-shell-text)]">
            No tickets yet
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Raise a ticket or share the public support link with this client.
          </p>
          <Button asChild className={`mt-4 ${workspaceBtnPrimaryMd}`}>
            <Link href={newHref}>
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {tickets.map((ticket) => {
              const detailHref = pathsConfig.app.accountSupportDetail
                .replace('[account]', accountSlug)
                .replace('[id]', ticket.id);

              return (
                <li key={ticket.id}>
                  <Link
                    href={detailHref}
                    className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--workspace-shell-canvas)]/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[var(--workspace-shell-text-muted)]">
                          {formatTicketNumber(ticket.ticketNumber)}
                        </span>
                        <TicketStatusBadge
                          status={ticket.status as TicketStatus}
                        />
                        <TicketPriorityBadge
                          priority={ticket.priority as TicketPriority}
                        />
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {ticket.title}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                      {formatTicketDate(ticket.createdAt)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
