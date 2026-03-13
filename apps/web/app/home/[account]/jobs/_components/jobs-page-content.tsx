'use client';

import { useCallback, useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../_lib/error-message';
import { listJobs } from '../_lib/server/server-actions';
import { CreateJobSheet } from './create-job-sheet';

type JobRow = {
  id: string;
  title: string;
  client_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  value_pence: number | null;
  assignment_count: number;
  clients?: { display_name: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatValue(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

export function JobsPageContent({
  accountSlug,
  accountId,
  canViewJobs,
  canEditJobs,
  isContractorView,
}: {
  accountSlug: string;
  accountId: string;
  canViewJobs: boolean;
  canEditJobs: boolean;
  isContractorView: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listJobs({
        accountId,
        tab,
        page,
        pageSize,
        query: searchDebounced || undefined,
      });
      const err = result?.error ?? (result as { error?: unknown })?.error;
      if (err) {
        toast.error(getErrorMessage(err));
        setJobs([]);
        setTotal(0);
        return;
      }
      if (result?.data !== undefined) {
        setJobs((result.data ?? []) as unknown as JobRow[]);
        setTotal(result.total ?? 0);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, tab, page, pageSize, searchDebounced]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, searchDebounced]);

  useEffect(() => {
    if (!canEditJobs || searchParams.get('create') !== 'job') {
      return;
    }

    setCreateSheetOpen(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextPath, { scroll: false });
  }, [canEditJobs, pathname, router, searchParams]);

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const jobDetailPath = pathsConfig.app.accountJobDetail.replace(
    '[account]',
    accountSlug,
  );

  if (!canViewJobs) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">
          You don&apos;t have access to jobs in this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Status pills + header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700 px-4 py-3 md:px-6">
          <div className="inline-flex rounded-full border border-white/8 bg-[var(--workspace-control-surface)]/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`px-3 py-1.5 font-medium transition-colors rounded-full ${
                tab === 'active'
                  ? 'bg-emerald-500 text-[#05120b]'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`px-3 py-1.5 font-medium transition-colors rounded-full ${
                tab === 'completed'
                  ? 'bg-emerald-500 text-[#05120b]'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Completed
            </button>
          </div>

          <If condition={canEditJobs}>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500"
              data-test="create-job-button"
              onClick={() => setCreateSheetOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create job
            </Button>
          </If>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-700 p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <p className="text-sm text-zinc-500">
                <Trans i18nKey="common:loading" />
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-zinc-500">
                {searchDebounced
                  ? 'No jobs match your search.'
                  : tab === 'active'
                    ? 'No active jobs. Create a job to get started.'
                    : 'No completed jobs.'}
              </p>
              {canEditJobs && !searchDebounced && tab === 'active' && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => setCreateSheetOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create job
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-y-1 border-spacing-x-0">
                <thead>
                  <tr className="text-zinc-400">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Client</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Priority</th>
                    <th className="pb-2 pr-4 font-medium">Due date</th>
                    {!isContractorView && (
                      <th className="pb-2 pr-4 font-medium">Value</th>
                    )}
                    <th className="pb-2 pr-4 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="cursor-pointer bg-[var(--workspace-shell-panel)]/70 hover:bg-[var(--workspace-shell-panel-hover)] transition-colors"
                      onClick={() => {
                        window.location.href = jobDetailPath.replace('[id]', job.id);
                      }}
                    >
                      <td className="rounded-l-xl py-2.5 pl-3 pr-4 font-medium text-white">
                        <Link
                          href={jobDetailPath.replace('[id]', job.id)}
                          className="hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {job.clients?.display_name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : job.status === 'cancelled'
                                ? 'bg-zinc-600 text-zinc-400'
                                : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {STATUS_LABELS[job.status] ?? job.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {PRIORITY_LABELS[job.priority] ?? job.priority}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {formatDueDate(job.due_date)}
                      </td>
                      {!isContractorView && (
                        <td className="py-2.5 pr-4 text-zinc-300">
                          {formatValue(job.value_pence)}
                        </td>
                      )}
                      <td className="rounded-r-xl py-2.5 pr-3 text-zinc-300">
                        {job.assignment_count > 0
                          ? `${job.assignment_count} assigned`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="mt-4 flex items-center justify-between px-4 py-3 md:px-6">
            <p className="text-sm text-zinc-500">
              Page {page} of {totalPages} ({total} jobs)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-600 text-zinc-400 hover:bg-[var(--workspace-shell-panel-hover)]"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-600 text-zinc-400 hover:bg-[var(--workspace-shell-panel-hover)]"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <CreateJobSheet
          open={createSheetOpen}
          onOpenChange={setCreateSheetOpen}
          accountId={accountId}
          accountSlug={accountSlug}
          onSuccess={fetchJobs}
        />
      </div>
    </div>
  );
}
