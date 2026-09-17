'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { RightmovePublicationStatusBadge } from '~/components/commercial/rightmove-publication-status-badge';
import type { AdminRightmoveWorkspaceOption } from '~/lib/commercial/admin-rightmove-sync';
import { formatRightmoveBulkJobStatus } from '~/lib/commercial/admin-rightmove-sync';
import { LISTING_STATUS_LABELS } from '~/lib/commercial/commercial-constants';
import { listingTabHref } from '~/lib/commercial/listing-routes';
import type { RightmoveFlushRun } from '~/lib/commercial/rightmove-flush-job-types';
import type { RightmoveOverviewStatus } from '~/lib/commercial/rightmove-publish-status';
import { formatUkDateTime } from '~/lib/format/uk-datetime';

import type {
  AdminRightmoveJobRow,
  AdminRightmoveListingRow,
} from '../_lib/load-admin-rightmove-sync';

const FILTERS: Array<{
  value: 'all' | 'pending' | RightmoveOverviewStatus;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending flush' },
  { value: 'unsynced', label: 'Unsynced' },
  { value: 'failed', label: 'Failed' },
  { value: 'pushed', label: 'Pushed' },
  { value: 'not_pushed', label: 'Not pushed' },
  { value: 'removed', label: 'Removed' },
];

export function AdminRightmoveSyncMonitor({
  listings,
  total,
  statusCounts,
  workspaces,
  jobs,
  flushRuns,
  currentFilter,
  currentAccountId,
  currentQuery,
  page,
  pageSize,
}: {
  listings: AdminRightmoveListingRow[];
  total: number;
  statusCounts: Record<RightmoveOverviewStatus, number>;
  workspaces: AdminRightmoveWorkspaceOption[];
  jobs: AdminRightmoveJobRow[];
  flushRuns: RightmoveFlushRun[];
  currentFilter: string;
  currentAccountId: string;
  currentQuery: string;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const latestFlush = flushRuns[0] ?? null;

  const pushFilter = (next: {
    filter?: string;
    accountId?: string;
    query?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const filter = next.filter ?? currentFilter;
    const accountId = next.accountId ?? currentAccountId;
    const query = next.query ?? currentQuery;
    const nextPage = next.page ?? 1;
    if (filter && filter !== 'all') params.set('status', filter);
    if (accountId.trim()) params.set('account', accountId.trim());
    if (query.trim()) params.set('query', query.trim());
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.push(qs ? `/admin/rightmove?${qs}` : '/admin/rightmove');
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Unsynced"
          value={statusCounts.unsynced}
          hint="Live on Rightmove and waiting for the 15-minute flush"
        />
        <SummaryCard
          label="Failed"
          value={statusCounts.failed}
          hint="Last push returned an error"
        />
        <SummaryCard
          label="Last flush"
          value={
            latestFlush
              ? `${latestFlush.succeeded} succeeded / ${latestFlush.failed} failed`
              : '—'
          }
          hint={
            latestFlush
              ? `Started ${formatUkDateTime(latestFlush.startedAt)}`
              : 'No flush run recorded yet'
          }
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent flush runs</h2>
        {flushRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No flush runs recorded yet. The 15-minute cron writes a row here
            after each pass.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Succeeded</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flushRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{formatUkDateTime(run.startedAt)}</TableCell>
                  <TableCell>{run.processed}</TableCell>
                  <TableCell>{run.succeeded}</TableCell>
                  <TableCell>{run.failed}</TableCell>
                  <TableCell className="max-w-xs truncate text-rose-600">
                    {run.lastError ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent bulk jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No Push all or Resync jobs yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Failures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{formatUkDateTime(job.startedAt)}</TableCell>
                  <TableCell>
                    {job.accountSlug ? (
                      <Link
                        href={`/home/${job.accountSlug}/commercial-publishing`}
                        className="underline-offset-2 hover:underline"
                      >
                        {job.accountName}
                      </Link>
                    ) : (
                      job.accountName
                    )}
                  </TableCell>
                  <TableCell>
                    {job.scope === 'unsynced' ? 'Resync' : 'Push all'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatRightmoveBulkJobStatus(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.processed}/{job.total} · {job.succeeded} succeeded /{' '}
                    {job.failed} failed
                  </TableCell>
                  <TableCell className="max-w-xs text-xs">
                    {job.lastError ? (
                      <p className="text-rose-600">{job.lastError}</p>
                    ) : null}
                    {job.failureNames.length > 0 ? (
                      <p className="text-muted-foreground">
                        {job.failureNames.slice(0, 4).join(', ')}
                        {job.failureNames.length > 4
                          ? ` +${job.failureNames.length - 4} more`
                          : ''}
                      </p>
                    ) : job.lastError ? null : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Publications</h2>
            <p className="text-muted-foreground text-xs">
              {total} matching · {statusCounts.pushed} pushed,{' '}
              {statusCounts.unsynced} unsynced, {statusCounts.not_pushed} not
              pushed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentAccountId}
              onChange={(event) =>
                pushFilter({ accountId: event.target.value })
              }
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              aria-label="Filter by workspace"
            >
              <option value="">All workspaces</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <Input
              defaultValue={currentQuery}
              placeholder="Search disposal or workspace"
              className="w-64"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  pushFilter({
                    query: (event.target as HTMLInputElement).value,
                  });
                }
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => pushFilter({ filter: filter.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                currentFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {filter.label}
              {filter.value === 'unsynced'
                ? ` (${statusCounts.unsynced})`
                : filter.value === 'failed'
                  ? ` (${statusCounts.failed})`
                  : filter.value === 'not_pushed'
                    ? ` (${statusCounts.not_pushed})`
                    : ''}
            </button>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Disposal</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Rightmove</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Listing updated</TableHead>
              <TableHead>Pending flush</TableHead>
              <TableHead>Last error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  No Rightmove publications match these filters.
                </TableCell>
              </TableRow>
            ) : (
              listings.map((row) => (
                <TableRow key={`${row.accountId}:${row.listingId}`}>
                  <TableCell>
                    <div className="font-medium">
                      {row.accountSlug ? (
                        <Link
                          href={listingTabHref(
                            row.accountSlug,
                            row.listingId,
                            'publishing',
                          )}
                          className="underline-offset-2 hover:underline"
                        >
                          {row.listingName}
                        </Link>
                      ) : (
                        row.listingName
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {LISTING_STATUS_LABELS[
                        row.listingStatus as keyof typeof LISTING_STATUS_LABELS
                      ] ?? 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.accountSlug ? (
                      <Link
                        href={`/home/${row.accountSlug}/commercial-publishing`}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.accountName}
                      </Link>
                    ) : (
                      row.accountName
                    )}
                  </TableCell>
                  <TableCell>
                    <RightmovePublicationStatusBadge
                      status={row.overviewStatus}
                    />
                  </TableCell>
                  <TableCell>{formatUkDateTime(row.lastSyncAt)}</TableCell>
                  <TableCell>
                    {formatUkDateTime(row.listingUpdatedAt)}
                  </TableCell>
                  <TableCell>{row.pendingFlush ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="max-w-xs truncate text-rose-600">
                    {row.lastError ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pageCount > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushFilter({ page: page - 1 })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => pushFilter({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}
