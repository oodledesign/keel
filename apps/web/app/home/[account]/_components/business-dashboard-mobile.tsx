'use client';

import { ChevronRight, StickyNote } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import { workspaceDashboardMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNoteSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { DashboardTaskDetailTrigger } from '~/components/dashboard/dashboard-task-detail-trigger';
import { FinanceTrendBarChart } from '~/components/finance/finance-charts';
import pathsConfig from '~/config/paths.config';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

type BusinessDashboardMobileProps = {
  accountSlug: string;
  accountId: string;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  upcomingTasks: DashboardTaskSummary[];
  recentNotes: DashboardNoteSummary[];
  shortcutsBar: React.ReactNode;
};

export function BusinessDashboardMobile({
  accountSlug,
  accountId,
  metrics,
  financeTrend,
  upcomingTasks,
  recentNotes,
  shortcutsBar,
}: BusinessDashboardMobileProps) {
  const revenueTrendData =
    financeTrend.length > 0
      ? financeTrend
      : buildRevenueTrendFallback(metrics.totalRevenuePence / 100);

  const totalRevenueLabel = metrics.hasFinanceData
    ? formatCurrency(metrics.financeIncomePence / 100)
    : formatCurrency(metrics.totalRevenuePence / 100);

  const netLabel = metrics.hasFinanceData
    ? formatCurrency(metrics.financeNetPence / 100)
    : null;

  const tasksHref = pathsConfig.app.accountTasks.replace('[account]', accountSlug);
  const notesHref = pathsConfig.app.accountNotes.replace('[account]', accountSlug);
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
            <p className="text-[10px] font-medium uppercase tracking-wide text-violet-200/60">
              {metrics.hasFinanceData ? 'This month' : 'Revenue'}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
              {totalRevenueLabel}
            </p>
            {netLabel ? (
              <p className="mt-0.5 text-xs text-zinc-400">
                Net {netLabel}
              </p>
            ) : null}
          </div>
          <div className="text-right text-[11px] text-zinc-400">
            <p>{metrics.activeProjects} active projects</p>
            <p>{metrics.hoursLogged}h logged</p>
          </div>
        </div>
        <div className="mt-3 h-36">
          <FinanceTrendBarChart data={revenueTrendData} variant="grouped" />
        </div>
      </section>

      <section className="xl:col-span-2">{shortcutsBar}</section>

      <section className={panelClass}>
        <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Upcoming tasks</h2>
          <HapticLink
            href={tasksHref}
            className="flex items-center gap-0.5 text-xs font-medium text-[#5eead4]"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </HapticLink>
        </div>
        <ul className="divide-y divide-white/6">
          {upcomingTasks.length === 0 ? (
            <li className="px-4 py-4 text-sm text-violet-200/70">
              No upcoming tasks.
            </li>
          ) : (
            upcomingTasks.map((task) => (
              <li key={task.id}>
                <DashboardTaskDetailTrigger
                  taskId={task.id}
                  workspaceAccountId={accountId}
                  className="flex flex-col gap-0.5 px-4 py-3 active:bg-white/4"
                >
                  <span className="text-sm font-medium text-white">
                    {task.title}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {[task.projectName, formatTaskDue(task.dueDate)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </DashboardTaskDetailTrigger>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-white">Recent notes</h2>
          <HapticLink
            href={notesHref}
            className="flex items-center gap-0.5 text-xs font-medium text-[#5eead4]"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </HapticLink>
        </div>

        {recentNotes.length === 0 ? (
          <div className={cn(panelClass, 'px-4 py-6 text-sm text-violet-200/70')}>
            No notes yet.
          </div>
        ) : (
          <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentNotes.map((note) => (
              <HapticLink
                key={note.id}
                href={noteDetailPath(note.id)}
                className={cn(
                  panelClass,
                  'w-[calc(50%-0.375rem)] shrink-0 snap-start p-3 transition-transform active:scale-[0.98] md:w-56 lg:w-64',
                )}
              >
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/8 text-[#5eead4]">
                  <StickyNote className="h-3.5 w-3.5" />
                </div>
                <p className="line-clamp-2 text-sm font-medium text-white">
                  {note.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                  {note.excerpt}
                </p>
                <p className="mt-2 text-[10px] text-zinc-500">
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTaskDue(iso: string | null): string | null {
  if (!iso) return 'No due date';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return null;
  }
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
