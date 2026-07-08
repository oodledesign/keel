'use client';

import Link from 'next/link';

import { ArrowRight, Layers } from 'lucide-react';

import pathsConfig from '~/config/paths.config';

import type { WorkspaceOverviewCard } from '../../_lib/server/ozer-dashboard.loader';

type Props = {
  cards: WorkspaceOverviewCard[];
  includeWorkspaceTasks: boolean;
  settingsHref: string;
};

export function ConnectedWorkspacesBar({ cards, includeWorkspaceTasks, settingsHref }: Props) {
  if (cards.length === 0) return null;

  const tasksBase = `${pathsConfig.app.home}/tasks`;

  return (
    <div className="rounded-2xl border border-[#FF5C34]/20 bg-[var(--ozer-accent)]/[0.06] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Connected across {cards.length}{' '}
              {cards.length === 1 ? 'workspace' : 'workspaces'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text)]/55">
              {includeWorkspaceTasks
                ? 'Tasks, calendar, and shortcuts span every workspace from your personal home.'
                : 'Workspace overview is still here — turn on unified tasks in settings to mix them into Today’s Focus.'}
            </p>
          </div>
        </div>

        <Link
          href={tasksBase}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--ozer-accent)] hover:text-[#34b3a4]"
        >
          All tasks
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cards.map((card) => {
          const openStat = card.stats.find((s) => s.label === 'Open tasks');
          const openCount = openStat?.value ?? '0';
          const workspaceHref = pathsConfig.app.accountHome.replace(
            '[account]',
            card.slug,
          );
          const tasksHref = `${tasksBase}?workspace=${encodeURIComponent(card.slug)}`;

          return (
            <div
              key={card.id}
              className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 pr-2"
            >
              <Link
                href={workspaceHref}
                className="inline-flex max-w-[160px] items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--workspace-shell-text)]/90 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: card.color }}
                />
                <span className="truncate">{card.name}</span>
              </Link>
              <Link
                href={tasksHref}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--workspace-shell-text)]/50 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--ozer-accent)]"
                title={`${openCount} open tasks in ${card.name}`}
              >
                {openCount} tasks
              </Link>
            </div>
          );
        })}

        {!includeWorkspaceTasks ? (
          <Link
            href={settingsHref}
            className="inline-flex items-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-1.5 text-xs text-[var(--workspace-shell-text)]/50 transition-colors hover:border-[color:var(--workspace-shell-border)] hover:text-[var(--workspace-shell-text)]/70"
          >
            Include workspace tasks
          </Link>
        ) : null}
      </div>
    </div>
  );
}
