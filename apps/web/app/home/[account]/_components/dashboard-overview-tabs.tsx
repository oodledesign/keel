'use client';

import { useState } from 'react';

import {
  Briefcase,
  ChevronRight,
  FolderKanban,
  Receipt,
  Users,
} from 'lucide-react';

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
import { InvoiceStatusBadge } from '../invoices/_components/invoice-status-badge';
import { DashboardStatusPill } from './dashboard-ui';

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

const TABS: {
  id: DashboardOverviewTab;
  label: string;
  icon: typeof FolderKanban;
}[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
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

  const projectHref = (id: string) =>
    pathsConfig.app.accountJobDetail
      .replace('[account]', accountSlug)
      .replace('[id]', id);

  const invoiceHref = (id: string) =>
    pathsConfig.app.accountInvoiceEdit
      .replace('[account]', accountSlug)
      .replace('[id]', id);

  return (
    <section className={cn(panelClass, density === 'lg' && 'xl:col-span-2')}>
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === item.id
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {item.label}
              </button>
            );
          })}
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
          <ul className="space-y-1">
            {projects.length === 0 ? (
              <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
                No active projects.
              </li>
            ) : (
              projects.map((project) => (
                <li key={project.id}>
                  <HapticLink
                    href={projectHref(project.id)}
                    className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  >
                    <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {project.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <DashboardStatusPill
                          kind="project"
                          status={project.status}
                        />
                        {project.clientName ? (
                          <span className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                            {project.clientName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </HapticLink>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === 'team' ? (
        <ul className="space-y-1 p-3">
          {teamMembers.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No team members yet.
            </li>
          ) : (
            teamMembers.slice(0, 8).map((member) => (
              <li key={member.userId}>
                <HapticLink
                  href={membersHref}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {member.name?.trim() || member.email || 'Team member'}
                    </p>
                    <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {[member.role, member.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </HapticLink>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === 'invoices' ? (
        <ul className="space-y-1 p-3">
          {invoices.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No open invoices.
            </li>
          ) : (
            invoices.map((invoice) => (
              <li key={invoice.id}>
                <HapticLink
                  href={invoiceHref(invoice.id)}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {invoice.invoiceNumber}
                      </p>
                      <span className="shrink-0 text-xs font-medium text-[var(--workspace-shell-text)]">
                        {formatMoney(invoice.totalPence)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <InvoiceStatusBadge
                        status={invoice.status}
                        due_at={invoice.dueAt}
                        total_pence={invoice.totalPence}
                      />
                      {invoice.clientName ? (
                        <span className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                          {invoice.clientName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </HapticLink>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
