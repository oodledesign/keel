'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CalendarDays,
  ChevronDown,
  Columns3,
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
import { listCampaignProjects } from '../_lib/campaign/server/server-actions';
import { listAccountMembers, listJobs } from '../_lib/server/server-actions';
import { CreateProjectDialog } from './create-project-dialog';
import { JobsPmMainTable, type JobsPmRow } from './jobs-pm/jobs-pm-main-table';
import { JobsPmTimelineView } from './jobs-pm/jobs-pm-timeline-view';
import { JobsPmToolbar } from './jobs-pm/jobs-pm-toolbar';
import {
  mapCampaignRowToKanbanItem,
  mapDeliveryRowToKanbanItem,
  ProjectsKanbanView,
  type ProjectsKanbanItem,
} from './projects-kanban-view';

type PageView = 'table' | 'timeline' | 'schedule' | 'kanban';
type ProjectTypeFilter = 'all' | 'delivery' | 'campaign';

export function JobsPageContent({
  accountSlug,
  accountId,
  canViewJobs,
  canEditJobs,
  isContractorView,
  uiVariant = 'projects',
  initialJobs,
  initialCampaigns,
  initialMembers,
}: {
  accountSlug: string;
  accountId: string;
  canViewJobs: boolean;
  canEditJobs: boolean;
  isContractorView: boolean;
  uiVariant?: 'projects' | 'maintenance';
  initialJobs?: JobsPmRow[];
  initialCampaigns?: Array<{ id: string; name: string; clientCount?: number }>;
  initialMembers?: Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    picture_url?: string | null;
  }>;
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

  const [jobs, setJobs] = useState<JobsPmRow[]>(initialJobs ?? []);
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; name: string; clientCount?: number }>
  >(initialCampaigns ?? []);
  const [loading, setLoading] = useState(initialJobs === undefined);
  const skipInitialFetchRef = useRef(initialJobs !== undefined);
  const [view, setView] = useState<PageView>(
    searchParams.get('view') === 'kanban' ? 'kanban' : 'table',
  );
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>(
    searchParams.get('type') === 'campaign'
      ? 'campaign'
      : searchParams.get('type') === 'delivery'
        ? 'delivery'
        : 'all',
  );
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<'delivery' | 'campaign'>(
    'delivery',
  );
  const [members, setMembers] = useState<
    {
      user_id: string;
      name: string | null;
      email: string | null;
      picture_url?: string | null;
    }[]
  >(initialMembers ?? []);

  const openCreateDialog = useCallback((type: 'delivery' | 'campaign' = 'delivery') => {
    setCreateDialogType(type);
    setCreateDialogOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === 'campaign') {
      openCreateDialog('campaign');
      const params = new URLSearchParams(searchParams.toString());
      params.delete('create');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [searchParams, pathname, router, openCreateDialog]);

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
      const [jobsSettled, campaignsSettled] = await Promise.allSettled([
        typeFilter === 'campaign'
          ? Promise.resolve({ data: [], total: 0 })
          : listJobs({
              accountId,
              tab: 'all',
              page: 1,
              pageSize: 200,
              ...(searchDebounced ? { query: searchDebounced } : {}),
              ...(priorityFilter
                ? {
                    priority: priorityFilter as
                      | 'low'
                      | 'medium'
                      | 'high'
                      | 'urgent',
                  }
                : {}),
            }),
        typeFilter === 'delivery'
          ? Promise.resolve([] as Array<{ id: string; name: string }>)
          : listCampaignProjects({ accountId }),
      ]);

      if (jobsSettled.status === 'rejected') {
        toast.error(getErrorMessage(jobsSettled.reason));
        setJobs([]);
      } else {
        const payload = jobsSettled.value as {
          data?: unknown;
          total?: number;
          error?: unknown;
        };

        if (payload?.error) {
          toast.error(getErrorMessage(payload.error));
          setJobs([]);
        } else {
          const rows = Array.isArray(payload?.data) ? payload.data : [];
          setJobs(rows as JobsPmRow[]);
        }
      }

      if (campaignsSettled.status === 'rejected') {
        toast.error(getErrorMessage(campaignsSettled.reason));
        setCampaigns([]);
      } else {
        const campaignsResult = campaignsSettled.value;
        const campaignRows = Array.isArray(campaignsResult)
          ? campaignsResult
          : ((campaignsResult as { projects?: Array<{ id: string; name: string }> })
              ?.projects ?? []);
        setCampaigns(
          campaignRows.map((row) => ({
            id: row.id,
            name: (row as { name: string }).name,
            clientCount: (row as { clientCount?: number }).clientCount,
          })),
        );
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
      setJobs([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, searchDebounced, priorityFilter, typeFilter]);

  useEffect(() => {
    if (
      skipInitialFetchRef.current &&
      !searchDebounced &&
      !priorityFilter &&
      typeFilter === 'all'
    ) {
      skipInitialFetchRef.current = false;
      return;
    }

    void fetchJobs();
  }, [fetchJobs, priorityFilter, searchDebounced, typeFilter]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (initialMembers !== undefined) {
      return;
    }

    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        setMembers(Array.isArray(raw) ? (raw as typeof members) : []);
      })
      .catch(() => setMembers([]));
  }, [accountSlug, initialMembers]);

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
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-[var(--workspace-shell-text-muted)]">
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
    { key: 'kanban', label: 'Board', icon: Columns3 },
    { key: 'timeline', label: 'Timeline', icon: GanttChart },
    { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  ];

  const visibleCampaigns =
    typeFilter === 'delivery'
      ? []
      : campaigns.filter((row) => {
          if (!searchDebounced.trim()) return true;
          return row.name.toLowerCase().includes(searchDebounced.trim().toLowerCase());
        });

  const visibleJobs = typeFilter === 'campaign' ? [] : jobs;
  const kanbanItems: ProjectsKanbanItem[] = [
    ...visibleJobs.map((row) => mapDeliveryRowToKanbanItem(row as Record<string, unknown>)),
    ...visibleCampaigns.map((row) => mapCampaignRowToKanbanItem(row)),
  ];

  const typeFilters: { key: ProjectTypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'campaign', label: 'Campaign' },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
      {/* Page header — Monday-style */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">{copy.title}</h1>
          <ChevronDown className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
        </div>
        {canEditJobs && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text-muted)]"
            onClick={() => openCreateDialog('delivery')}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New project
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2 md:px-5">
        {typeFilters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === key
                ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]'
                : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-0 border-b border-[color:var(--workspace-shell-border)] px-2 md:px-3">
        {viewTabs.map(({ key, label, icon: Icon }) =>
          key === 'schedule' ? (
            <Link
              key={key}
              href={schedulePath}
              className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)]"
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
                  ? 'border-[#0073ea] text-[var(--workspace-shell-text)]'
                  : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ),
        )}
        <button
          type="button"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
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
          onNewProject={() => openCreateDialog('delivery')}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          uiVariant={uiVariant}
        />
      )}

      {loading ? (
        <div className="flex min-h-[320px] flex-1 items-center justify-center">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading projects…</p>
        </div>
      ) : view === 'table' ? (
        <JobsPmMainTable
          jobs={visibleJobs}
          campaigns={visibleCampaigns}
          accountSlug={accountSlug}
          accountId={accountId}
          canEditJobs={canEditJobs}
          isContractorView={isContractorView}
          members={members}
          onRefresh={fetchJobs}
          onAddProject={() => openCreateDialog('delivery')}
          uiVariant={uiVariant}
        />
      ) : view === 'kanban' ? (
        <ProjectsKanbanView accountSlug={accountSlug} items={kanbanItems} />
      ) : view === 'timeline' ? (
        <JobsPmTimelineView jobs={visibleJobs} jobDetailPath={jobDetailPath} />
      ) : null}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        onSuccess={fetchJobs}
        uiVariant={uiVariant}
        defaultType={createDialogType}
      />
    </div>
  );
}
