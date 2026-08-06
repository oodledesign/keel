'use client';

import { ChevronRight, LifeBuoy } from 'lucide-react';

import { HapticLink } from '~/components/haptic-link';
import { TicketPriorityBadge } from '~/components/support/ticket-status-badge';
import pathsConfig from '~/config/paths.config';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';

import type { DashboardSupportTicketSummary } from '../_lib/server/dashboard-page.loader';
import {
  formatTicketDate,
  formatTicketNumber,
} from '../support/_components/support-ticket-badges';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type Props = {
  accountSlug: string;
  tickets: DashboardSupportTicketSummary[];
  totalCount: number;
};

export function DashboardSupportTicketsCard({
  accountSlug,
  tickets,
  totalCount,
}: Props) {
  const supportHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );
  const waitingLabel =
    totalCount === 0
      ? 'You are caught up'
      : totalCount === 1
        ? '1 ticket needs a reply'
        : `${totalCount} tickets need a reply`;

  return (
    <section className={panelClass}>
      <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Support tickets
          </h2>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {waitingLabel}
          </p>
        </div>
        <HapticLink href={supportHref} className={dashboardLinkClass}>
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      {tickets.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
          <LifeBuoy className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          No open tickets need a reply right now.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {tickets.map((ticket) => {
            const href = pathsConfig.app.accountSupportDetail
              .replace('[account]', accountSlug)
              .replace('[id]', ticket.id);

            return (
              <li key={ticket.id}>
                <HapticLink
                  href={href}
                  className="flex min-w-0 items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] sm:px-4"
                >
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <p className="truncate font-mono text-[11px] text-[var(--workspace-shell-text-muted)]">
                        {formatTicketNumber(ticket.ticketNumber)}
                      </p>
                      <span className="shrink-0 text-[10px] text-[var(--workspace-shell-text-muted)] tabular-nums">
                        {formatEmailDateTime(ticket.lastActivityAt) ||
                          formatTicketDate(ticket.lastActivityAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {ticket.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <TicketPriorityBadge priority={ticket.priority} />
                      {ticket.clientName ? (
                        <span className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                          {ticket.clientName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </HapticLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
