import Link from 'next/link';

import { Repeat } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { formatMinorUnits } from '~/lib/billing/plan-templates-types';
import { projectRetainerHref } from '~/lib/retainers/client-retainer-summary';
import {
  type WorkspaceRetainerRow,
  summarizeWorkspaceRetainers,
  workspaceRetainersHref,
} from '~/lib/retainers/workspace-retainers';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

export function FinancesRetainersBlock({
  accountSlug,
  rows,
}: {
  accountSlug: string;
  rows: WorkspaceRetainerRow[];
}) {
  const summary = summarizeWorkspaceRetainers(rows);
  const retainersHref = workspaceRetainersHref(accountSlug);
  const pendingHref = workspaceRetainersHref(accountSlug, {
    status: 'pending',
  });

  return (
    <section className="space-y-3" data-test="finances-retainers">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Retainers
          </h3>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={retainersHref}>View retainers</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={cn(panelClass, 'min-w-0 p-2.5 sm:p-4')}>
          <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-sm">
            Retainer MRR
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--workspace-shell-text)] tabular-nums sm:mt-2 sm:text-2xl">
            {formatMinorUnits(summary.mrrPence, summary.currency)}
          </p>
        </div>
        <div className={cn(panelClass, 'min-w-0 p-2.5 sm:p-4')}>
          <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-sm">
            Active
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--workspace-shell-text)] tabular-nums sm:mt-2 sm:text-2xl">
            {summary.activeCount}
          </p>
        </div>
        <div className={cn(panelClass, 'min-w-0 p-2.5 sm:p-4')}>
          <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-sm">
            Awaiting payment
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--workspace-shell-text)] tabular-nums sm:mt-2 sm:text-2xl">
            {summary.pendingCount}
          </p>
        </div>
      </div>

      {summary.pendingCount > 0 ? (
        <p
          className={cn(
            workspacePanelCard,
            'px-3 py-2 text-sm text-[var(--workspace-shell-text)]',
          )}
        >
          {summary.pendingCount === 1
            ? '1 retainer is awaiting payment.'
            : `${summary.pendingCount} retainers are awaiting payment.`}{' '}
          <Link
            href={pendingHref}
            className="font-medium text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
          >
            Review pending
          </Link>
        </p>
      ) : null}

      {summary.top.length > 0 ? (
        <ul
          className={cn(
            panelClass,
            'divide-y divide-[color:var(--workspace-shell-border)]',
          )}
        >
          {summary.top.map((row) => {
            const href = row.projectId
              ? projectRetainerHref(accountSlug, row.projectId)
              : retainersHref;
            return (
              <li key={row.id}>
                <Link
                  href={href}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {row.clientName}
                      {row.projectTitle ? ` · ${row.projectTitle}` : ''}
                    </p>
                    <p className={`truncate text-xs ${workspaceTextMuted}`}>
                      {row.planName}
                      {row.canPay ? ' · Awaiting payment' : ''}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--workspace-shell-text)] tabular-nums">
                    {row.amountPence > 0
                      ? formatMinorUnits(
                          row.amountPence,
                          row.currency,
                          row.interval,
                        )
                      : '—'}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No active or pending retainers.{' '}
          <Link
            href={retainersHref}
            className="font-medium text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
          >
            Add a retainer
          </Link>
        </p>
      )}
    </section>
  );
}
