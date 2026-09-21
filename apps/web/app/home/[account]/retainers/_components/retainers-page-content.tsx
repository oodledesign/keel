'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { workspacePageContentClassName } from '~/components/workspace-shell/workspace-shell-styles';
import {
  clientSubscriptionStatusLabel,
  clientSubscriptionStatusStyles,
} from '~/lib/billing/client-subscription-status';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';
import { projectRetainerHref } from '~/lib/retainers/client-retainer-summary';
import {
  type WorkspaceRetainerClientChoice,
  type WorkspaceRetainerProjectChoice,
  type WorkspaceRetainerRow,
  type WorkspaceRetainerStatusFilter,
  filterWorkspaceRetainerRows,
} from '~/lib/retainers/workspace-retainers';
import {
  workspaceFilterActive,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { AddWorkspaceRetainerButton } from './add-workspace-retainer-button';

const STATUS_FILTERS: Array<{
  id: WorkspaceRetainerStatusFilter;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
];

function formatNextBilling(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({ status }: { status: WorkspaceRetainerRow['status'] }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text-muted)]">
        Credits
      </span>
    );
  }

  const key = status in clientSubscriptionStatusStyles ? status : 'pending';
  const style = clientSubscriptionStatusStyles[key];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {status === 'pending' || status === 'incomplete'
        ? 'Pending'
        : clientSubscriptionStatusLabel(status)}
    </span>
  );
}

function rowHref(accountSlug: string, row: WorkspaceRetainerRow) {
  return row.projectId ? projectRetainerHref(accountSlug, row.projectId) : null;
}

export function RetainersPageContent({
  accountId,
  accountSlug,
  canEdit,
  initialRows,
  initialClients,
  initialProjects,
  initialStatus,
}: {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  initialRows: WorkspaceRetainerRow[];
  initialClients: WorkspaceRetainerClientChoice[];
  initialProjects: WorkspaceRetainerProjectChoice[];
  initialStatus?: WorkspaceRetainerStatusFilter;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<WorkspaceRetainerStatusFilter>(
    initialStatus ?? 'all',
  );
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => filterWorkspaceRetainerRows(initialRows, { status, query }),
    [initialRows, query, status],
  );

  const addButton = (
    <AddWorkspaceRetainerButton
      accountId={accountId}
      accountSlug={accountSlug}
      clients={initialClients}
      projects={initialProjects}
      canEdit={canEdit}
    />
  );

  return (
    <div className={cn('space-y-4', workspacePageContentClassName)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatus(filter.id)}
              className={cn(
                'rounded-full border border-[color:var(--workspace-shell-border)] px-3 py-1 text-xs font-medium text-[var(--workspace-shell-text-muted)]',
                status === filter.id && workspaceFilterActive,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {addButton}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients"
          className="border-[color:var(--workspace-shell-border)] bg-transparent pl-9 text-[var(--workspace-shell-text)]"
        />
      </div>

      {initialRows.length === 0 ? (
        <div className={cn(workspacePanelCard, 'p-6 text-center')}>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            No retainers yet
          </p>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Add a retainer on a project to attach a plan and manage credits
            there.
          </p>
          {canEdit ? (
            <div className="mt-4 flex justify-center">{addButton}</div>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(workspacePanelCard, 'p-6 text-center')}>
          <p className={`text-sm ${workspaceTextMuted}`}>
            No retainers match these filters.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden md:block">
            <div className={cn(workspacePanelCard, 'overflow-hidden')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[var(--workspace-shell-text-muted)]">
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Credits</th>
                    <th className="px-4 py-2 font-medium">Next billing</th>
                    <th className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = rowHref(accountSlug, row);
                    const nextBilling = formatNextBilling(row.nextBillingDate);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-[color:var(--workspace-shell-border)]',
                          href &&
                            'cursor-pointer hover:bg-[var(--workspace-shell-panel-hover)]',
                        )}
                        onClick={() => {
                          if (href) router.push(href);
                        }}
                        data-test="workspace-retainer-row"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--workspace-shell-text)]">
                          {row.clientName}
                        </td>
                        <td className="px-4 py-3 text-[var(--workspace-shell-text)]">
                          {row.projectTitle ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--workspace-shell-text)]">
                          {row.planName}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--workspace-shell-text)]">
                          {row.amountPence > 0
                            ? formatMinorUnits(
                                row.amountPence,
                                row.currency,
                                row.interval,
                              )
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                          {row.creditBalance != null ? row.creditBalance : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
                          {nextBilling ?? '—'}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {href ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={href}>Edit</Link>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((row) => {
              const href = rowHref(accountSlug, row);
              const nextBilling = formatNextBilling(row.nextBillingDate);
              const body = (
                <div className={cn(workspacePanelCard, 'p-4')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {row.clientName}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-xs ${workspaceTextMuted}`}
                      >
                        {row.projectTitle ?? 'No project'} · {row.planName}
                      </p>
                    </div>
                    <StatusPill status={row.status} />
                  </div>
                  <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
                    {row.amountPence > 0
                      ? formatMinorUnits(
                          row.amountPence,
                          row.currency,
                          row.interval,
                        )
                      : 'No amount'}
                    {row.creditBalance != null
                      ? ` · ${row.creditBalance} credits`
                      : ''}
                    {nextBilling ? ` · Next ${nextBilling}` : ''}
                  </p>
                </div>
              );

              return (
                <li key={row.id} data-test="workspace-retainer-row">
                  {href ? <Link href={href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
