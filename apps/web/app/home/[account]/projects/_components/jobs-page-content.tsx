'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  CalendarDays,
  ChevronDown,
  Columns3,
  GanttChart,
  LayoutGrid,
  Plus,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PartnerBoardProject } from '~/lib/projects/partner-projects.loader';
import {
  type ProjectsUiVariant,
  projectDetailHref,
} from '~/lib/projects/project-paths';

import { listCampaignProjects } from '../_lib/campaign/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';
import { listAccountMembers, listJobs } from '../_lib/server/server-actions';
import { CreateProjectDialog } from './create-project-dialog';
import { JobsPmMainTable, type JobsPmRow } from './jobs-pm/jobs-pm-main-table';
import { JobsPmTimelineView } from './jobs-pm/jobs-pm-timeline-view';
import { JobsPmToolbar } from './jobs-pm/jobs-pm-toolbar';
import {
  type ProjectsKanbanItem,
  ProjectsKanbanView,
  mapCampaignRowToKanbanItem,
  mapDeliveryRowToKanbanItem,
} from './projects-kanban-view';
import { SharedPartnerProjectsSection } from './shared-partner-projects-section';

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
  sharedPartnerProjects = [],
  personalScope = false,
  projectDetailPathBuilder,
}: {
  accountSlug: string;
  accountId: string;
  canViewJobs: boolean;
  canEditJobs: boolean;
  isContractorView: boolean;
  uiVariant?: ProjectsUiVariant;
  initialJobs?: JobsPmRow[];
  initialCampaigns?: Array<{ id: string; name: string; clientCount?: number }>;
  initialMembers?: Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    picture_url?: string | null;
  }>;
  sharedPartnerProjects?: PartnerBoardProject[];
  personalScope?: boolean;
  projectDetailPathBuilder?: (id: string) => string;
}) {
  const isSimple = uiVariant === 'simple';
  const copy =
    uiVariant === 'maintenance'
      ? {
          title: 'Maintenance overview',
          accessDenied: 'maintenance jobs',
        }
      : {
          title: 'Projects',
          accessDenied: 'projects',
        };

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<JobsPmRow[]>(initialJobs ?? []);
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; name: string; clientCount?: number }>
  >(isSimple ? [] : (initialCampaigns ?? []));
  const [loading, setLoading] = useState(initialJobs === undefined);
  const skipInitialFetchRef = useRef(initialJobs !== undefined);
  const [view, setView] = useState<PageView>(
    isSimple
      ? 'table'
      : searchParams.get('view') === 'kanban'
        ? 'kanban'
        : 'table',
  );
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>(
    isSimple
      ? 'delivery'
      : searchParams.get('type') === 'campaign'
        ? 'campaign'
        : searchParams.get('type') === 'delivery'
          ? 'delivery'
          : 'all',
  );
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<
    'delivery' | 'campaign'
  >('delivery');
  const [members, setMembers] = useState<
    {
      user_id: string;
      name: string | null;
      email: string | null;
      picture_url?: string | null;
    }[]
  >(isSimple ? [] : (initialMembers ?? []));

  const openCreateDialog = useCallback(
    (type: 'delivery' | 'campaign' = 'delivery') => {
      setCreateDialogType(isSimple ? 'delivery' : type);
      setCreateDialogOpen(true);
    },
    [isSimple],
  );

  useEffect(() => {
    if (isSimple) return;
    if (searchParams.get('create') === 'campaign') {
      openCreateDialog('campaign');
      const params = new URLSearchParams(searchParams.toString());
      params.delete('create');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }
  }, [searchParams, pathname, router, openCreateDialog, isSimple]);

  const schedulePath = pathsConfig.app.accountSchedule.replace(
    '[account]',
    accountSlug,
  );
  const jobDetailPathTemplate = pathsConfig.app.accountJobDetail.replace(
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
        isSimple || typeFilter === 'delivery'
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

      if (isSimple) {
        setCampaigns([]);
      } else if (campaignsSettled.status === 'rejected') {
        toast.error(getErrorMessage(campaignsSettled.reason));
        setCampaigns([]);
      } else {
        const campaignsResult = campaignsSettled.value;
        const campaignRows = Array.isArray(campaignsResult)
          ? campaignsResult
          : ((
              campaignsResult as {
                projects?: Array<{ id: string; name: string }>;
              }
            )?.projects ?? []);
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
  }, [accountId, searchDebounced, priorityFilter, typeFilter, isSimple]);

  useEffect(() => {
    if (
      skipInitialFetchRef.current &&
      !searchDebounced &&
      !priorityFilter &&
      (isSimple || typeFilter === 'all')
    ) {
      skipInitialFetchRef.current = false;
      return;
    }

    void fetchJobs();
  }, [fetchJobs, priorityFilter, searchDebounced, typeFilter, isSimple]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (isSimple || initialMembers !== undefined) {
      return;
    }

    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        setMembers(Array.isArray(raw) ? (raw as typeof members) : []);
      })
      .catch(() => setMembers([]));
  }, [accountSlug, initialMembers, isSimple]);

  useEffect(() => {
    if (!canEditJobs || searchParams.get('create') !== 'job') {
      return;
    }

    openCreateDialog('delivery');

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextPath, { scroll: false });
  }, [canEditJobs, openCreateDialog, pathname, router, searchParams]);

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
  }[] = isSimple
    ? [
        { key: 'table', label: 'Main table', icon: LayoutGrid },
        { key: 'kanban', label: 'Board', icon: Columns3 },
        { key: 'timeline', label: 'Timeline', icon: GanttChart },
      ]
    : [
        { key: 'table', label: 'Main table', icon: LayoutGrid },
        { key: 'kanban', label: 'Board', icon: Columns3 },
        { key: 'timeline', label: 'Timeline', icon: GanttChart },
        { key: 'schedule', label: 'Schedule', icon: CalendarDays },
      ];

  const visibleCampaigns =
    isSimple || typeFilter === 'delivery'
      ? []
      : campaigns.filter((row) => {
          if (!searchDebounced.trim()) return true;
          return row.name
            .toLowerCase()
            .includes(searchDebounced.trim().toLowerCase());
        });

  const visibleJobs = typeFilter === 'campaign' ? [] : jobs;
  const sharedKanbanItems: ProjectsKanbanItem[] =
    typeFilter === 'campaign'
      ? []
      : sharedPartnerProjects.map((project) => ({
          id: `shared:${project.shareId}:${project.id}`,
          projectType: 'delivery' as const,
          status: project.status ?? 'in_progress',
          title: project.name,
          clientName: project.clientName,
          dueDate: null,
          href: pathsConfig.app.accountSharedClientProject
            .replace('[account]', accountSlug)
            .replace('[shareId]', project.shareId)
            .replace('[projectId]', project.id),
          sharedBadge: project.ownerAccountName
            ? `Shared · ${project.ownerAccountName}`
            : 'Shared',
          readOnly: true,
        }));
  const kanbanItems: ProjectsKanbanItem[] = [
    ...visibleJobs.map((row) =>
      mapDeliveryRowToKanbanItem(row as Record<string, unknown>),
    ),
    ...visibleCampaigns.map((row) => mapCampaignRowToKanbanItem(row)),
    ...sharedKanbanItems,
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
          <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">
            {copy.title}
          </h1>
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

      {!isSimple ? (
        <SharedPartnerProjectsSection
          accountSlug={accountSlug}
          projects={sharedPartnerProjects}
        />
      ) : null}

      {!isSimple ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2 md:px-5">
          {typeFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === key
                  ? 'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]'
                  : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

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
                  ? 'border-[var(--ozer-accent)] text-[var(--workspace-shell-text)]'
                  : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ),
        )}
        {!isSimple ? (
          <button
            type="button"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            aria-label="Add view"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
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
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading projects…
          </p>
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
          personalScope={personalScope}
        />
      ) : view === 'kanban' ? (
        <ProjectsKanbanView
          accountSlug={accountSlug}
          accountId={accountId}
          items={kanbanItems}
          canEditJobs={canEditJobs}
          personalScope={personalScope}
          projectDetailPathBuilder={projectDetailPathBuilder}
          onStatusUpdated={fetchJobs}
        />
      ) : view === 'timeline' ? (
        <JobsPmTimelineView
          jobs={visibleJobs}
          jobDetailPath={jobDetailPathTemplate}
          resolveDetailHref={(id) =>
            projectDetailPathBuilder?.(id) ??
            projectDetailHref(accountSlug, id, personalScope)
          }
          hideClient={isSimple}
        />
      ) : null}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        onSuccess={fetchJobs}
        uiVariant={uiVariant}
        defaultType={createDialogType}
        personalScope={personalScope}
        projectDetailPathBuilder={projectDetailPathBuilder}
      />
    </div>
  );
}
