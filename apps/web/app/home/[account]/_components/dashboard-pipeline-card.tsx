'use client';

import { ChevronRight, Kanban } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';
import { formatWorkspaceAmount } from '~/lib/currency/workspace-currency';
import type { DayViewPipeline } from '~/lib/planner/types';

import { DashboardPanelTitle, DashboardStatusPill } from './dashboard-ui';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type Props = {
  pipeline: DayViewPipeline | null;
  density?: 'sm' | 'md' | 'lg';
};

export function DashboardPipelineCard({ pipeline, density = 'md' }: Props) {
  const currency = useWorkspaceCurrency();
  const formatMoney = (value: number) => formatWorkspaceAmount(value, currency);

  if (!pipeline) {
    return (
      <section className={cn(panelClass, 'p-4')}>
        <DashboardPanelTitle icon={Kanban}>Pipeline</DashboardPanelTitle>
        <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
          No open deals yet.
        </p>
      </section>
    );
  }

  return (
    <section className={cn(panelClass, density === 'lg' && 'xl:col-span-2')}>
      <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div>
          <DashboardPanelTitle icon={Kanban}>Pipeline</DashboardPanelTitle>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {pipeline.openCount} open · {formatMoney(pipeline.openValue)}
          </p>
        </div>
        <HapticLink href={pipeline.href} className={dashboardLinkClass}>
          Open board
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {pipeline.stages.map((stage) => (
          <DashboardStatusPill
            key={stage.key}
            kind="pipeline"
            status={stage.key}
            label={stage.label}
            count={stage.count}
          />
        ))}
      </div>

      <ul className="space-y-2 p-3">
        {pipeline.needsAction.length === 0 ? (
          <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
            No actions due.
          </li>
        ) : (
          pipeline.needsAction.map((deal) => (
            <li
              key={deal.id}
              className="rounded-xl px-2 py-2 text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--workspace-shell-text)]">
                    {deal.name}
                  </p>
                  <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {deal.nextAction}
                  </p>
                </div>
                <DashboardStatusPill
                  kind="pipeline"
                  status={deal.stage}
                  label={deal.stageLabel}
                  className={
                    deal.overdue
                      ? 'ring-1 ring-[var(--ozer-accent)]'
                      : undefined
                  }
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
