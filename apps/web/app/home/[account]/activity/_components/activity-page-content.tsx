'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Settings2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { AnalyticsDateRangePicker } from '~/components/date-range/analytics-date-range-picker';
import type { DateRangeSelection } from '~/lib/date-range/analytics-date-range';
import {
  excludeActivityBlockAction,
  updateActivityBlockAction,
} from '~/home/[account]/activity/_lib/server/activity-blocks-actions';
import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  blockContextLabel,
  parseActivityAppContext,
} from '~/lib/activity/activity-app-context';
import { faviconUrlForDomain } from '~/lib/activity/activity-app-icons';
import {
  blockPageTitle,
  blockUrlLabel,
  formatDuration,
  formatTimeRange,
  groupBlocksByApp,
  groupBlocksByDay,
  sortActivityAppGroups,
  sumActiveDuration,
  sumTodayActiveDuration,
  type ActivityAppGroup,
  type ActivityBlockListRow,
  type ActivityDayGroup,
  type ActivitySortDir,
  type ActivitySortKey,
} from '~/lib/activity/activity-history';

import { ActivityAppIcon } from './activity-app-icon';

type Props = {
  data: ActivityPageData;
};

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

function ActivityUrlCell({ block }: { block: ActivityBlockListRow }) {
  const urlLabel = blockUrlLabel(block);

  if (!urlLabel) {
    return <span className="text-xs text-[var(--workspace-shell-text-muted)]">—</span>;
  }

  const domain =
    block.domain?.trim() ||
    (block.url?.trim() ? domainFromUrl(block.url.trim()) : null);
  const faviconSrc = domain ? faviconUrlForDomain(domain) : null;

  const content = (
    <>
      {faviconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconSrc}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span className="truncate">{urlLabel}</span>
    </>
  );

  if (block.url) {
    return (
      <a
        href={block.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-1.5 truncate text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
        title={urlLabel}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      className="flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--workspace-shell-text-muted)]"
      title={urlLabel}
    >
      {content}
    </span>
  );
}

function AppNameCell({
  block,
  nested = false,
}: {
  block: ActivityBlockListRow;
  nested?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {nested ? (
        <span className="w-[18px] shrink-0 text-center text-xs text-[var(--workspace-shell-text-muted)]">
          ↳
        </span>
      ) : (
        <ActivityAppIcon block={block} />
      )}
      <span
        className="truncate text-xs text-[var(--workspace-shell-text)]"
        title={block.appName}
      >
        {block.appName}
      </span>
    </div>
  );
}

function SortableTableHead({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: ActivitySortKey;
  activeSortKey: ActivitySortKey;
  sortDir: ActivitySortDir;
  onSort: (sortKey: ActivitySortKey) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={cn('h-9 px-3 text-xs', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 font-medium transition-colors',
          active
            ? 'text-[var(--workspace-shell-text)]'
            : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
        )}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </button>
    </TableHead>
  );
}

function ActivityAssignmentDisplay({
  block,
  interactive = false,
}: {
  block: ActivityBlockListRow;
  interactive?: boolean;
}) {
  const hasAssignment = Boolean(block.clientName || block.projectName);

  if (!hasAssignment) {
    return (
      <span
        className={cn(
          'text-xs text-[var(--workspace-shell-text-muted)]',
          interactive && 'underline-offset-2 group-hover:underline',
        )}
      >
        Assign client or project
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <span
        className="flex items-center gap-1 truncate text-xs font-medium text-[var(--workspace-shell-text)]"
        title={block.clientName ?? undefined}
      >
        {block.isConfirmed ? (
          <Check
            className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-label="Confirmed"
          />
        ) : null}
        {block.clientName ?? 'No client'}
      </span>
      <span
        className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
        title={block.projectName ?? undefined}
      >
        {block.projectName ?? 'No project'}
      </span>
    </div>
  );
}

function buildActivityUrl(
  accountSlug: string,
  params: { from: string; to: string; view: 'mine' | 'team' },
) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    view: params.view,
  });

  return `${workAccountPath(pathsConfig.app.accountActivity, accountSlug)}?${search.toString()}`;
}

function AppGroupNameCell({
  appGroup,
  representativeBlock,
}: {
  appGroup: ActivityAppGroup;
  representativeBlock: ActivityBlockListRow;
}) {
  const primaryLabel = appGroup.domainLabel ?? appGroup.appName;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ActivityAppIcon block={representativeBlock} />
      <div className="min-w-0">
        <span
          className="block truncate text-xs font-medium text-[var(--workspace-shell-text)]"
          title={primaryLabel}
        >
          {primaryLabel}
        </span>
        {appGroup.domainLabel ? (
          <span
            className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
            title={appGroup.appName}
          >
            {appGroup.appName}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AppItemCell({ block }: { block: ActivityBlockListRow }) {
  const appContext = parseActivityAppContext(block);

  if (!appContext?.item) {
    return <span className="text-xs text-[var(--workspace-shell-text-muted)]">—</span>;
  }

  return (
    <div className="min-w-0">
      <span
        className="block truncate text-xs text-[var(--workspace-shell-text)]"
        title={appContext.item}
      >
        {appContext.item}
      </span>
      {appContext.meta ? (
        <span className="text-[10px] text-[var(--workspace-shell-text-muted)]">
          {appContext.meta}
        </span>
      ) : null}
    </div>
  );
}

function ActivityBlockAssignmentCell({
  block,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  block: ActivityBlockListRow;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(block.projectId ?? 'none');
  const [clientId, setClientId] = useState(block.clientId ?? 'none');

  function runAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    nextBlock: ActivityBlockListRow,
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        toast.error(result.error ?? 'Update failed');
        return;
      }

      toast.success('Activity updated');
      onUpdated(nextBlock);
      setOpen(false);
    });
  }

  if (!canEdit || block.isExcluded) {
    return (
      <ActivityAssignmentDisplay block={block} />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group min-w-0 max-w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--workspace-control-surface)]/60"
          disabled={pending}
        >
          <ActivityAssignmentDisplay block={block} interactive />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Assign block
        </p>
        <div className="space-y-2">
          <Select value={clientId} onValueChange={setClientId} disabled={pending}>
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId} disabled={pending}>
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="keel-gradient-btn flex-1"
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  updateActivityBlockAction({
                    accountId,
                    accountSlug,
                    blockId: block.id,
                    projectId: projectId === 'none' ? null : projectId,
                    clientId: clientId === 'none' ? null : clientId,
                    isConfirmed: true,
                  }),
                {
                  ...block,
                  projectId: projectId === 'none' ? null : projectId,
                  clientId: clientId === 'none' ? null : clientId,
                  projectName:
                    projects.find((project) => project.id === projectId)?.name ??
                    null,
                  clientName:
                    clients.find((client) => client.id === clientId)?.name ?? null,
                  isConfirmed: true,
                },
              )
            }
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  excludeActivityBlockAction({
                    accountId,
                    accountSlug,
                    blockId: block.id,
                  }),
                { ...block, isExcluded: true },
              )
            }
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AppDetailCell({ block }: { block: ActivityBlockListRow }) {
  const appContext = parseActivityAppContext(block);

  if (!appContext?.detail) {
    return <span className="text-xs text-[var(--workspace-shell-text-muted)]">—</span>;
  }

  return (
    <span
      className="block truncate text-xs text-[var(--workspace-shell-text)]"
      title={appContext.detail}
    >
      {appContext.detail}
    </span>
  );
}

function ActivityBlockTableRow({
  block,
  canEdit,
  showMember,
  showApp = true,
  nested = false,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  block: ActivityBlockListRow;
  canEdit: boolean;
  showMember: boolean;
  showApp?: boolean;
  nested?: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const pageTitle = blockContextLabel(block);
  const rawTitle = block.windowTitle.trim() || blockPageTitle(block);

  return (
    <TableRow
      className={cn(
        'border-[color:var(--workspace-shell-border)] text-sm',
        nested && 'bg-[var(--workspace-control-surface)]/20',
        block.isExcluded && 'opacity-50',
      )}
    >
      {showApp ? (
        <TableCell
          className={cn(
            'max-w-[9rem] py-2 align-top',
            nested ? 'pl-8 pr-3' : 'px-3',
          )}
        >
          <AppNameCell block={block} nested={nested} />
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs font-medium text-[var(--workspace-shell-text)]">
        {formatDuration(block.durationSeconds)}
      </TableCell>
      <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]">
        {formatTimeRange(block.startedAt, block.endedAt)}
      </TableCell>
      <TableCell className="max-w-[8rem] px-3 py-2 align-top">
        <AppItemCell block={block} />
      </TableCell>
      <TableCell className="max-w-[10rem] px-3 py-2 align-top">
        <AppDetailCell block={block} />
      </TableCell>
      <TableCell className="max-w-[12rem] px-3 py-2 align-top">
        <span
          className="block truncate text-xs text-[var(--workspace-shell-text)]"
          title={rawTitle}
        >
          {pageTitle}
        </span>
      </TableCell>
      <TableCell className="max-w-[16rem] px-3 py-2 align-top">
        <ActivityUrlCell block={block} />
      </TableCell>
      {showMember ? (
        <TableCell className="max-w-[8rem] px-3 py-2 align-top">
          <span
            className="block truncate text-xs text-[var(--workspace-shell-text-muted)]"
            title={block.userName ?? undefined}
          >
            {block.userName ?? '—'}
          </span>
        </TableCell>
      ) : null}
      <TableCell className="max-w-[11rem] px-3 py-2 align-top">
        <ActivityBlockAssignmentCell
          block={block}
          canEdit={canEdit}
          projects={projects}
          clients={clients}
          accountId={accountId}
          accountSlug={accountSlug}
          onUpdated={onUpdated}
        />
      </TableCell>
    </TableRow>
  );
}

function ActivityAppGroupRows({
  appGroup,
  expanded,
  onToggle,
  canEdit,
  showMember,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  appGroup: ActivityAppGroup;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  showMember: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const sessionLabel = `${appGroup.blocks.length} session${appGroup.blocks.length === 1 ? '' : 's'}`;
  const isSingleBlock = appGroup.blocks.length === 1;

  if (isSingleBlock) {
    return (
      <ActivityBlockTableRow
        block={appGroup.blocks[0]!}
        canEdit={canEdit}
        showMember={showMember}
        showApp
        projects={projects}
        clients={clients}
        accountId={accountId}
        accountSlug={accountSlug}
        onUpdated={onUpdated}
      />
    );
  }

  const representativeBlock = appGroup.blocks[0]!;

  return (
    <>
      <TableRow
        className="cursor-pointer border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 hover:bg-[var(--workspace-control-surface)]/40"
        onClick={onToggle}
      >
        <TableCell className="max-w-[9rem] px-3 py-2 align-top">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
            )}
            <AppGroupNameCell
              appGroup={appGroup}
              representativeBlock={representativeBlock}
            />
          </button>
        </TableCell>
        <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs font-semibold text-[var(--workspace-shell-text)]">
          {formatDuration(appGroup.totalDurationSeconds)}
        </TableCell>
        <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]">
          {sessionLabel}
        </TableCell>
        <TableCell
          colSpan={showMember ? 6 : 5}
          className="px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]"
        >
          Click to {expanded ? 'collapse' : 'expand'} individual sessions
        </TableCell>
      </TableRow>
      {expanded
        ? appGroup.blocks.map((block) => (
            <ActivityBlockTableRow
              key={block.id}
              block={block}
              canEdit={canEdit}
              showMember={showMember}
              showApp
              nested
              projects={projects}
              clients={clients}
              accountId={accountId}
              accountSlug={accountSlug}
              onUpdated={onUpdated}
            />
          ))
        : null}
    </>
  );
}

function ActivityDayTable({
  group,
  canEdit,
  showMember,
  projects,
  clients,
  accountId,
  accountSlug,
  sortKey,
  sortDir,
  onSort,
  onUpdated,
}: {
  group: ActivityDayGroup;
  canEdit: boolean;
  showMember: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  sortKey: ActivitySortKey;
  sortDir: ActivitySortDir;
  onSort: (sortKey: ActivitySortKey) => void;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const appGroups = useMemo(
    () => sortActivityAppGroups(groupBlocksByApp(group.blocks), sortKey, sortDir),
    [group.blocks, sortDir, sortKey],
  );
  const [expandedApps, setExpandedApps] = useState<Set<string>>(() => new Set());

  function toggleApp(appKey: string) {
    setExpandedApps((current) => {
      const next = new Set(current);

      if (next.has(appKey)) {
        next.delete(appKey);
      } else {
        next.add(appKey);
      }

      return next;
    });
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          {group.label}
        </h2>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {formatDuration(group.totalDurationSeconds)}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <Table>
          <TableHeader className="bg-[var(--workspace-shell-sidebar-accent)]">
            <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
              <SortableTableHead
                label="App"
                sortKey="app"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableTableHead
                label="Duration"
                sortKey="duration"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableTableHead
                label="Time"
                sortKey="time"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <TableHead className="h-9 px-3 text-xs">Item</TableHead>
              <TableHead className="h-9 px-3 text-xs">Detail</TableHead>
              <TableHead className="h-9 px-3 text-xs">Context</TableHead>
              <TableHead className="h-9 px-3 text-xs">URL / domain</TableHead>
              {showMember ? (
                <TableHead className="h-9 px-3 text-xs">Member</TableHead>
              ) : null}
              <TableHead className="h-9 px-3 text-xs">Assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appGroups.map((appGroup) => (
              <ActivityAppGroupRows
                key={appGroup.appKey}
                appGroup={appGroup}
                expanded={expandedApps.has(appGroup.appKey)}
                onToggle={() => toggleApp(appGroup.appKey)}
                canEdit={canEdit}
                showMember={showMember}
                projects={projects}
                clients={clients}
                accountId={accountId}
                accountSlug={accountSlug}
                onUpdated={onUpdated}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function ActivityPageContent({ data }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(data.blocks);
  const [sortKey, setSortKey] = useState<ActivitySortKey>('duration');
  const [sortDir, setSortDir] = useState<ActivitySortDir>('desc');

  useEffect(() => {
    setRows(data.blocks);
  }, [data.blocks]);

  function handleSort(nextKey: ActivitySortKey) {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDir(nextKey === 'app' ? 'asc' : 'desc');
  }

  const settingsPath = workAccountPath(
    pathsConfig.app.accountActivityPrivacySettings,
    data.accountSlug,
  );

  const dayGroups = useMemo(() => groupBlocksByDay(rows), [rows]);
  const activeDuration = useMemo(() => sumActiveDuration(rows), [rows]);
  const todayDuration = useMemo(() => sumTodayActiveDuration(rows), [rows]);

  function updateBlock(updated: ActivityBlockListRow) {
    setRows((current) =>
      current.map((row) => (row.id === updated.id ? updated : row)),
    );
    router.refresh();
  }

  function navigate(next: {
    from?: string;
    to?: string;
    view?: 'mine' | 'team';
  }) {
    router.push(
      buildActivityUrl(data.accountSlug, {
        from: next.from ?? data.dateFrom,
        to: next.to ?? data.dateTo,
        view: next.view ?? data.view,
      }),
    );
  }

  function onDateRangeApply(from: string, to: string, _selection: DateRangeSelection) {
    navigate({ from, to });
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">Today</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {formatDuration(todayDuration)}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Selected range
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {formatDuration(activeDuration)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={data.view}
          onValueChange={(value) =>
            navigate({ view: value === 'team' ? 'team' : 'mine' })
          }
        >
          <TabsList className="bg-[var(--workspace-shell-panel)]">
            <TabsTrigger value="mine">My activity</TabsTrigger>
            {data.canViewTeamActivity ? (
              <TabsTrigger value="team">Team</TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsDateRangePicker
            fromIso={data.dateFrom}
            toIso={data.dateTo}
            onApply={onDateRangeApply}
          />
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={settingsPath}>
              <Settings2 className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {!data.trackingEnabled && data.view === 'mine' ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-5 w-5 text-amber-200" />
            <div className="space-y-2">
              <p className="font-medium text-[var(--workspace-shell-text)]">
                Activity tracking is disabled
              </p>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                KeelAssistant uploads are blocked until you enable tracking for
                this workspace.
              </p>
              <Button asChild size="sm" className="keel-gradient-btn">
                <Link href={settingsPath}>Open activity settings</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-center">
          <Activity className="mx-auto h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
          <p className="mt-3 text-lg font-medium text-[var(--workspace-shell-text)]">
            No activity in this range
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {data.trackingEnabled
              ? 'Use KeelAssistant and tap Upload now to sync your latest blocks.'
              : 'Enable tracking in settings, then upload from KeelAssistant.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          {dayGroups.map((group) => (
            <ActivityDayTable
              key={group.dayKey}
              group={group}
              canEdit={data.canEdit}
              showMember={data.view === 'team'}
              projects={data.projects}
              clients={data.clients}
              accountId={data.accountId}
              accountSlug={data.accountSlug}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onUpdated={updateBlock}
            />
          ))}
        </div>
      )}
    </div>
  );
}
