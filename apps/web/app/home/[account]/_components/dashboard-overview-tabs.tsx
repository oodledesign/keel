'use client';

import { useState } from 'react';

import { ChevronRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import type { DashboardOverviewTab } from '~/config/dashboard-presets.config';
import pathsConfig from '~/config/paths.config';
import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';
import { formatWorkspaceAmount } from '~/lib/currency/workspace-currency';

import type {
  DashboardInvoiceSummary,
  DashboardJobSummary,
  DashboardStatusSummary,
} from '../_lib/server/dashboard-page.loader';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type TeamMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type Props = {
  accountSlug: string;
  projects: DashboardJobSummary[];
  statusSummary: DashboardStatusSummary;
  teamMembers: TeamMember[];
  invoices: DashboardInvoiceSummary[];
  defaultTab?: DashboardOverviewTab;
  density?: 'sm' | 'md' | 'lg';
};

const TABS: { id: DashboardOverviewTab; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'team', label: 'Team' },
  { id: 'invoices', label: 'Invoices' },
];

export function DashboardOverviewTabs({
  accountSlug,
  projects,
  statusSummary,
  teamMembers,
  invoices,
  defaultTab = 'projects',
  density = 'md',
}: Props) {
  const [tab, setTab] = useState<DashboardOverviewTab>(defaultTab);
  const currency = useWorkspaceCurrency();
  const formatMoney = (pence: number) =>
    formatWorkspaceAmount(pence / 100, currency);

  const projectsHref = pathsConfig.app.accountProjects.replace(
    '[account]',
    accountSlug,
  );
  const membersHref = pathsConfig.app.accountMembers.replace(
    '[account]',
    accountSlug,
  );
  const invoicesHref = pathsConfig.app.accountInvoices.replace(
    '[account]',
    accountSlug,
  );

  const viewAllHref =
    tab === 'projects'
      ? projectsHref
      : tab === 'team'
        ? membersHref
        : invoicesHref;

  return (
    <section className={cn(panelClass, density === 'lg' && 'xl:col-span-2')}>
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                tab === item.id
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <HapticLink
          href={viewAllHref}
          className={cn(dashboardLinkClass, 'shrink-0')}
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      {tab === 'projects' ? (
        <div className="p-3">
          <p className="mb-2 px-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
            {statusSummary.inProgress} in progress · {statusSummary.pending}{' '}
            pending · {statusSummary.completed} completed
          </p>
          <ul className="space-y-2">
            {projects.length === 0 ? (
              <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
                No active projects.
              </li>
            ) : (
              projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-xl px-2 py-2 hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {project.title}
                  </p>
                  <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {[project.clientName, project.status]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === 'team' ? (
        <ul className="space-y-2 p-3">
          {teamMembers.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No team members yet.
            </li>
          ) : (
            teamMembers.slice(0, 8).map((member) => (
              <li
                key={member.userId}
                className="rounded-xl px-2 py-2 hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {member.name?.trim() || member.email || 'Team member'}
                </p>
                <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {[member.role, member.email].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === 'invoices' ? (
        <ul className="space-y-2 p-3">
          {invoices.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No open invoices.
            </li>
          ) : (
            invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="rounded-xl px-2 py-2 hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {[invoice.clientName, invoice.status]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[var(--workspace-shell-text)]">
                    {formatMoney(invoice.totalPence)}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
