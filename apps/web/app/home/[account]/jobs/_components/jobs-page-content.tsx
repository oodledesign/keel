'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  CalendarDays,
  ChevronDown,
  GanttChart,
  LayoutGrid,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../_lib/error-message';
import { listAccountMembers, listJobs } from '../_lib/server/server-actions';
import { CreateJobSheet } from './create-job-sheet';
import { JobsPmMainTable, type JobsPmRow } from './jobs-pm/jobs-pm-main-table';
import { JobsPmTimelineView } from './jobs-pm/jobs-pm-timeline-view';
import { JobsPmToolbar } from './jobs-pm/jobs-pm-toolbar';

type PageView = 'table' | 'timeline' | 'schedule';

export function JobsPageContent({
  accountSlug,
  accountId,
  canViewJobs,
  canEditJobs,
  isContractorView,
  uiVariant = 'projects',
}: {
  accountSlug: string;
  accountId: string;
  canViewJobs: boolean;
  canEditJobs: boolean;
  isContractorView: boolean;
  uiVariant?: 'projects' | 'maintenance';
}) {
  const copy =
    uiVariant === 'maintenance'
      ? {
          title: 'Maintenance overview',
          accessDenied: 'maintenance jobs',
        }
      : {
          title: 'Projects overview',
          accessDenied: 'projects',
        };

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<JobsPmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PageView>('table');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [members, setMembers] = useState<
    {
      user_id: string;
      name: string | null;
      email: string | null;
      picture_url?: string | null;
    }[]
  >([]);

  const schedulePath = pathsConfig.app.accountSchedule.replace(
    '[account]',
    accountSlug,
  );
  const jobDetailPath = pathsConfig.app.accountJobDetail.replace(
    '[account]',
    accountSlug,
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listJobs({
        accountId,
        tab: 'all',
        page: 1,
        pageSize: 200,
        query: searchDebounced || undefined,
        priority: priorityFilter as
          | 'low'
          | 'medium'
          | 'high'
          | 'urgent'
          | undefined,
      });
      const err = result?.error ?? (result as { error?: unknown })?.error;
      if (err) {
        toast.error(getErrorMessage(err));
        setJobs([]);
        return;
      }
      if (result?.data !== undefined) {
        setJobs((result.data ?? []) as unknown as JobsPmRow[]);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, searchDebounced, priorityFilter]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        setMembers(Array.isArray(raw) ? (raw as typeof members) : []);
      })
      .catch(() => setMembers([]));
  }, [accountSlug]);

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

  if (!canViewJobs) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">
          You don&apos;t have access to {copy.accessDenied} in this account.
        </p>
      </div>
    );
  }

  const viewTabs: {
    key: PageView;
    label: string;
    icon: typeof LayoutGrid;
  }[] = [
    { key: 'table', label: 'Main table', icon: LayoutGrid },
    { key: 'timeline', label: 'Timeline', icon: GanttChart },
    { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)]/40">
      {/* Page header — Monday-style */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">{copy.title}</h1>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </div>
        {canEditJobs && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 text-xs text-zinc-300"
            onClick={() => setCreateSheetOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Quick add
          </Button>
        )}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-0 border-b border-white/8 px-2 md:px-3">
        {viewTabs.map(({ key, label, icon: Icon }) =>
          key === 'schedule' ? (
            <Link
              key={key}
              href={schedulePath}
              className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                view === key
                  ? 'border-[#0073ea] text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ),
        )}
        <button
          type="button"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-white/5 hover:text-white"
          aria-label="Add view"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {view === 'table' && (
        <JobsPmToolbar
          search={search}
          onSearchChange={setSearch}
          canEditJobs={canEditJobs}
          onNewProject={() => setCreateSheetOpen(true)}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          uiVariant={uiVariant}
        />
      )}

      {loading ? (
        <div className="flex min-h-[320px] flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Loading projects…</p>
        </div>
      ) : view === 'table' ? (
        <JobsPmMainTable
          jobs={jobs}
          accountSlug={accountSlug}
          accountId={accountId}
          canEditJobs={canEditJobs}
          isContractorView={isContractorView}
          members={members}
          onRefresh={fetchJobs}
          onAddProject={() => setCreateSheetOpen(true)}
          uiVariant={uiVariant}
        />
      ) : view === 'timeline' ? (
        <JobsPmTimelineView jobs={jobs} jobDetailPath={jobDetailPath} />
      ) : null}

      <CreateJobSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        onSuccess={fetchJobs}
      />
    </div>
  );
}
