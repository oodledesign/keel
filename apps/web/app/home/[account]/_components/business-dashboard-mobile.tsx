'use client';

import dynamic from 'next/dynamic';

import { ArrowUpRight, ChevronRight, StickyNote } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import { workspaceDashboardMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';
import { formatWorkspaceAmount } from '~/lib/currency/workspace-currency';

import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { DashboardNeedsReplyCard } from './dashboard-needs-reply-card';
import { DashboardUpcomingTaskItem } from './dashboard-upcoming-task-item';
import { NoteAssignmentLabels } from './note-assignment-labels';

const FinanceTrendBarChart = dynamic(
  () =>
    import('~/components/finance/finance-charts').then(
      (mod) => mod.FinanceTrendBarChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
    ),
  },
);

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type BusinessDashboardMobileProps = {
  accountSlug: string;
  accountId: string;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  upcomingTasks: DashboardTaskSummary[];
  needsReply: DashboardNeedsReplySummary;
  recentNotes: DashboardNoteSummary[];
  shortcutsBar: React.ReactNode;
};

export function BusinessDashboardMobile({
  accountSlug,
  accountId,
  metrics,
  financeTrend,
  upcomingTasks,
  needsReply,
  recentNotes,
  shortcutsBar,
}: BusinessDashboardMobileProps) {
  const workspaceCurrency = useWorkspaceCurrency();
  const formatMoney = (value: number) =>
    formatWorkspaceAmount(value, workspaceCurrency);
  const revenueTrendData =
    financeTrend.length > 0
      ? financeTrend
      : buildRevenueTrendFallback(metrics.totalRevenuePence / 100);

  const totalRevenueLabel = metrics.hasFinanceData
    ? formatMoney(metrics.financeIncomePence / 100)
    : formatMoney(metrics.totalRevenuePence / 100);

  const netLabel = metrics.hasFinanceData
    ? formatMoney(metrics.financeNetPence / 100)
    : null;

  const tasksHref = pathsConfig.app.accountTasks.replace(
    '[account]',
    accountSlug,
  );
  const notesHref = pathsConfig.app.accountNotes.replace(
    '[account]',
    accountSlug,
  );
  const financesHref = pathsConfig.app.accountFinances.replace(
    '[account]',
    accountSlug,
  );
  const noteDetailPath = (id: string) =>
    pathsConfig.app.accountNoteDetail
      .replace('[account]', accountSlug)
      .replace('[noteId]', id);

  return (
    <div
      className={cn(
        workspaceDashboardMainClassName,
        'xl:grid xl:grid-cols-2 xl:items-start xl:gap-6',
      )}
    >
      <section className={cn(panelClass, 'overflow-hidden p-4 xl:col-span-2')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              {metrics.hasFinanceData ? 'This month' : 'Revenue'}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--workspace-shell-text)]">
              {totalRevenueLabel}
            </p>
            {netLabel ? (
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                Net {netLabel}
              </p>
            ) : null}
          </div>
          <div className="text-right text-[11px] text-[var(--workspace-shell-text-muted)]">
            <p>{metrics.activeProjects} active projects</p>
            <p>{metrics.hoursLogged}h logged</p>
          </div>
        </div>
        <div className="relative mt-3 h-36">
          <FinanceTrendBarChart
            data={revenueTrendData}
            variant="grouped"
            surface="workspace"
            compact
            currency={workspaceCurrency}
          />
          <HapticLink
            href={financesHref}
            aria-label="Open finances"
            className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text-muted)] shadow-sm transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)]"
          >
            <ArrowUpRight className="h-4 w-4" />
          </HapticLink>
        </div>
      </section>

      {shortcutsBar ? (
        <section className="xl:col-span-2">{shortcutsBar}</section>
      ) : null}

      <DashboardNeedsReplyCard
        accountSlug={accountSlug}
        accountId={accountId}
        threads={needsReply.threads}
        totalCount={needsReply.totalCount}
      />

      <section className={panelClass}>
        <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Upcoming tasks
          </h2>
          <HapticLink href={tasksHref} className={dashboardLinkClass}>
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </HapticLink>
        </div>
        <ul className="space-y-2 p-3">
          {upcomingTasks.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No upcoming tasks.
            </li>
          ) : (
            upcomingTasks.map((task) => (
              <DashboardUpcomingTaskItem
                key={task.id}
                task={task}
                workspaceAccountId={accountId}
              />
            ))
          )}
        </ul>
      </section>

      <section className="xl:col-span-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Recent notes
          </h2>
          <HapticLink href={notesHref} className={dashboardLinkClass}>
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </HapticLink>
        </div>

        {recentNotes.length === 0 ? (
          <div
            className={cn(
              panelClass,
              'px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]',
            )}
          >
            No notes yet.
          </div>
        ) : (
          <div
            data-horizontal-scroll
            className="flex touch-pan-x snap-x snap-mandatory scroll-pl-0 gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {recentNotes.map((note) => (
              <HapticLink
                key={note.id}
                href={noteDetailPath(note.id)}
                className={cn(
                  panelClass,
                  'w-[min(16rem,calc(100%-1.5rem))] shrink-0 snap-start snap-always p-3 transition-transform active:scale-[0.98] sm:w-56 lg:w-64',
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
                    <StickyNote className="h-3.5 w-3.5" />
                  </div>
                  <NoteAssignmentLabels
                    clientName={note.clientName}
                    projectName={note.projectName}
                  />
                </div>
                <p className="line-clamp-2 text-sm font-medium text-[var(--workspace-shell-text)]">
                  {note.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  {note.excerpt}
                </p>
                <p className="mt-2 text-[10px] text-[var(--workspace-shell-text-muted)]">
                  {formatRelativeDate(note.updatedAt)}
                </p>
              </HapticLink>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function buildRevenueTrendFallback(currentRevenue: number) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const fallback = currentRevenue > 0 ? currentRevenue : 48392;
  const multipliers = [0.68, 0.74, 0.82, 0.79, 0.9, 1];

  return multipliers.map((multiplier, index) => {
    const monthsAgo = multipliers.length - 1 - index;
    const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const income = Math.round(fallback * multiplier);
    const expenses = Math.round(income * 0.43);

    return {
      month: formatter.format(date),
      income,
      expenses,
      net: income - expenses,
      isCurrent: monthsAgo === 0,
    };
  });
}
