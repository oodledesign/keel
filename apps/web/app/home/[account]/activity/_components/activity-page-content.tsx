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
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Settings2,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { cn } from '@kit/ui/utils';

import { AnalyticsDateRangePicker } from '~/components/date-range/analytics-date-range-picker';
import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  applyActivitySuggestionsAction,
  suggestActivityAssignmentsAction,
} from '~/home/[account]/activity/_lib/server/activity-assignment-actions';
import {
  bulkExcludeActivityBlocksAction,
  bulkUpdateActivityBlocksAction,
  createActivityRuleAction,
} from '~/home/[account]/activity/_lib/server/activity-blocks-actions';
import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import {
  type ActivityRuleMatch,
  activityRuleMatchKey,
  blockContextLabel,
  findActivityRuleMatchByKey,
  intersectActivityRuleMatchOptions,
  parseActivityAppContext,
  resolveIdeRepoName,
} from '~/lib/activity/activity-app-context';
import { faviconUrlForDomain } from '~/lib/activity/activity-app-icons';
import {
  type ActivityAppGroup,
  type ActivityBlockListRow,
  type ActivityDayGroup,
  type ActivityLayoutMode,
  type ActivitySessionGroup,
  type ActivitySortDir,
  type ActivitySortKey,
  type ActivityStatusFilter,
  aggregateActivityByApp,
  blockPageTitle,
  blockUrlLabel,
  formatDuration,
  formatTimeRange,
  groupBlocksByApp,
  groupBlocksByDay,
  shiftActivityFocusDate,
  sortActivityAppGroups,
  sumActiveDuration,
  sumTodayActiveDuration,
} from '~/lib/activity/activity-history';
import type { DateRangeSelection } from '~/lib/date-range/analytics-date-range';

import { ActivityAppIcon } from './activity-app-icon';
import {
  ActivityBlockAssignmentCell,
  ActivityRememberRuleSelector,
  type WorkClassification,
} from './activity-block-assignment-cell';
import { ActivityDayView } from './activity-day-view';
import { ActivityLayoutNav } from './activity-layout-nav';
import { ActivityReviewDigest } from './activity-review-digest';
import { ActivityWeekView } from './activity-week-view';

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
    return (
      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
        —
      </span>
    );
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

function buildActivityUrl(
  accountSlug: string,
  params: {
    from: string;
    to: string;
    view: 'mine' | 'team';
    status?: ActivityStatusFilter;
    layout?: ActivityLayoutMode;
    date?: string;
  },
) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    view: params.view,
  });

  if (params.layout) {
    search.set('layout', params.layout);
  }

  if (params.date) {
    search.set('date', params.date);
  }

  if (params.status && params.status !== 'all') {
    search.set('status', params.status);
  }

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

  if (appContext?.kind === 'ide') {
    if (appContext.detail === 'Agents') {
      const repo = appContext.repo ?? resolveIdeRepoName(block);
      const taskOrFile = appContext.meta?.trim() ?? null;
      const workspace =
        repo ??
        (appContext.item?.trim() &&
        appContext.item.trim().toLowerCase() !== 'agents'
          ? appContext.item.trim()
          : null);
      const primary = workspace ?? taskOrFile ?? 'Agents';
      const secondaryParts: string[] = [];

      if (workspace && taskOrFile) {
        secondaryParts.push(taskOrFile);
      }

      if (workspace || taskOrFile) {
        secondaryParts.push('Agents');
      }

      const secondary =
        secondaryParts.length > 0 ? secondaryParts.join(' · ') : null;

      return (
        <div className="min-w-0">
          <span
            className="block truncate text-xs font-medium text-[var(--workspace-shell-text)]"
            title={primary}
          >
            {primary}
          </span>
          {secondary ? (
            <span
              className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
              title={secondary}
            >
              {secondary}
            </span>
          ) : null}
        </div>
      );
    }

    const repo = appContext.repo ?? resolveIdeRepoName(block);
    const workspace = appContext.item?.trim() ?? null;
    const file = appContext.detail?.trim() ?? null;
    const primary = repo ?? workspace ?? file;
    const secondary = repo
      ? (file ??
        (workspace && workspace.toLowerCase() !== repo.toLowerCase()
          ? workspace
          : null))
      : file;

    if (!primary) {
      return (
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          —
        </span>
      );
    }

    return (
      <div className="min-w-0">
        <span
          className="block truncate text-xs font-medium text-[var(--workspace-shell-text)]"
          title={primary}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
            title={secondary}
          >
            {secondary}
          </span>
        ) : null}
      </div>
    );
  }

  if (appContext?.kind === 'assistant') {
    const primary = appContext.item?.trim() || 'Claude';
    const secondary = [appContext.detail, appContext.meta]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className="min-w-0">
        <span
          className="block truncate text-xs font-medium text-[var(--workspace-shell-text)]"
          title={primary}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
            title={secondary}
          >
            {secondary}
          </span>
        ) : null}
      </div>
    );
  }

  if (!appContext?.item) {
    return (
      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
        —
      </span>
    );
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

function AppDetailCell({ block }: { block: ActivityBlockListRow }) {
  const appContext = parseActivityAppContext(block);

  if (!appContext?.detail) {
    return (
      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
        —
      </span>
    );
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
  selectable = false,
  selected = false,
  onSelectedChange,
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
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (blockId: string, selected: boolean) => void;
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
        selected && 'bg-[var(--ozer-accent-subtle)]/30',
      )}
    >
      {selectable ? (
        <TableCell className="w-10 px-3 py-2 align-top">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) =>
              onSelectedChange?.(block.id, checked === true)
            }
            aria-label={`Select ${rawTitle}`}
          />
        </TableCell>
      ) : null}
      {showApp ? (
        <TableCell
          className={cn(
            'max-w-[9rem] py-2 align-top',
            nested ? 'pr-3 pl-8' : 'px-3',
          )}
        >
          <AppNameCell block={block} nested={nested} />
        </TableCell>
      ) : (
        <TableCell className="max-w-[9rem] px-3 py-2 align-top" aria-hidden />
      )}
      <TableCell className="px-3 py-2 align-top text-xs font-medium whitespace-nowrap text-[var(--workspace-shell-text)]">
        {formatDuration(block.durationSeconds)}
      </TableCell>
      <TableCell className="px-3 py-2 align-top text-xs whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
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

function SessionUrlCell({
  block,
  label,
}: {
  block: ActivityBlockListRow;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 pl-4">
      <span className="w-[18px] shrink-0 text-center text-xs text-[var(--workspace-shell-text-muted)]">
        ↳
      </span>
      <ActivityAppIcon block={block} />
      <span
        className="truncate text-xs font-medium text-[var(--workspace-shell-text)]"
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

function ActivitySessionGroupRows({
  sessionGroup,
  appKey,
  expanded,
  onToggle,
  canEdit,
  showMember,
  selectable,
  selectedBlockIds,
  onSelectedChange,
  onGroupSelectedChange,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  sessionGroup: ActivitySessionGroup;
  appKey: string;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  showMember: boolean;
  selectable: boolean;
  selectedBlockIds: Set<string>;
  onSelectedChange: (blockId: string, selected: boolean) => void;
  onGroupSelectedChange: (blockIds: string[], selected: boolean) => void;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const representativeBlock = sessionGroup.blocks[0]!;
  const selectableBlocks = sessionGroup.blocks.filter(
    (block) => !block.isExcluded,
  );
  const selectedCount = selectableBlocks.filter((block) =>
    selectedBlockIds.has(block.id),
  ).length;
  const groupChecked =
    selectableBlocks.length > 0 && selectedCount === selectableBlocks.length;
  const groupIndeterminate =
    selectedCount > 0 && selectedCount < selectableBlocks.length;
  const sessionLabel = `${sessionGroup.blocks.length} block${sessionGroup.blocks.length === 1 ? '' : 's'}`;

  if (sessionGroup.blocks.length === 1) {
    return (
      <ActivityBlockTableRow
        block={representativeBlock}
        canEdit={canEdit}
        showMember={showMember}
        showApp={false}
        nested
        selectable={selectable && !representativeBlock.isExcluded}
        selected={selectedBlockIds.has(representativeBlock.id)}
        onSelectedChange={onSelectedChange}
        projects={projects}
        clients={clients}
        accountId={accountId}
        accountSlug={accountSlug}
        onUpdated={onUpdated}
      />
    );
  }

  return (
    <>
      <TableRow
        className="cursor-pointer border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/15 hover:bg-[var(--workspace-control-surface)]/30"
        onClick={onToggle}
      >
        {selectable ? (
          <TableCell className="w-10 px-3 py-2 align-top">
            <Checkbox
              checked={groupIndeterminate ? 'indeterminate' : groupChecked}
              onCheckedChange={(checked) =>
                onGroupSelectedChange(
                  selectableBlocks.map((block) => block.id),
                  checked === true,
                )
              }
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select all ${sessionGroup.label} blocks`}
            />
          </TableCell>
        ) : null}
        <TableCell className="max-w-[12rem] px-3 py-2 align-top" colSpan={1}>
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
            <SessionUrlCell
              block={representativeBlock}
              label={sessionGroup.label}
            />
          </button>
        </TableCell>
        <TableCell className="px-3 py-2 align-top text-xs font-semibold whitespace-nowrap text-[var(--workspace-shell-text)]">
          {formatDuration(sessionGroup.totalDurationSeconds)}
        </TableCell>
        <TableCell className="px-3 py-2 align-top text-xs whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
          {formatTimeRange(sessionGroup.startedAt, sessionGroup.endedAt)}
        </TableCell>
        <TableCell
          colSpan={showMember ? (selectable ? 6 : 5) : selectable ? 5 : 4}
          className="px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]"
        >
          {sessionLabel} · {expanded ? 'collapse' : 'expand'}
        </TableCell>
      </TableRow>
      {expanded
        ? sessionGroup.blocks.map((block) => (
            <ActivityBlockTableRow
              key={block.id}
              block={block}
              canEdit={canEdit}
              showMember={showMember}
              showApp={false}
              nested
              selectable={selectable && !block.isExcluded}
              selected={selectedBlockIds.has(block.id)}
              onSelectedChange={onSelectedChange}
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

function ActivityAppGroupRows({
  appGroup,
  expanded,
  onToggle,
  canEdit,
  showMember,
  selectable,
  selectedBlockIds,
  onSelectedChange,
  onGroupSelectedChange,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
  expandedSessions,
  onToggleSession,
}: {
  appGroup: ActivityAppGroup;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  showMember: boolean;
  selectable: boolean;
  selectedBlockIds: Set<string>;
  onSelectedChange: (blockId: string, selected: boolean) => void;
  onGroupSelectedChange: (blockIds: string[], selected: boolean) => void;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
  expandedSessions: Set<string>;
  onToggleSession: (sessionKey: string) => void;
}) {
  const sessionLabel = `${appGroup.sessionGroups.length} session${appGroup.sessionGroups.length === 1 ? '' : 's'}`;
  const isSingleBlock =
    appGroup.sessionGroups.length === 1 &&
    appGroup.sessionGroups[0]!.blocks.length === 1;
  const selectableBlocks = appGroup.blocks.filter((block) => !block.isExcluded);
  const selectedCount = selectableBlocks.filter((block) =>
    selectedBlockIds.has(block.id),
  ).length;
  const groupChecked =
    selectableBlocks.length > 0 && selectedCount === selectableBlocks.length;
  const groupIndeterminate =
    selectedCount > 0 && selectedCount < selectableBlocks.length;

  if (isSingleBlock) {
    const block = appGroup.blocks[0]!;
    return (
      <ActivityBlockTableRow
        block={block}
        canEdit={canEdit}
        showMember={showMember}
        showApp
        selectable={selectable && !block.isExcluded}
        selected={selectedBlockIds.has(block.id)}
        onSelectedChange={onSelectedChange}
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
        {selectable ? (
          <TableCell className="w-10 px-3 py-2 align-top">
            <Checkbox
              checked={groupIndeterminate ? 'indeterminate' : groupChecked}
              onCheckedChange={(checked) =>
                onGroupSelectedChange(
                  selectableBlocks.map((block) => block.id),
                  checked === true,
                )
              }
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select all ${appGroup.domainLabel ?? appGroup.appName} sessions`}
            />
          </TableCell>
        ) : null}
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
        <TableCell className="px-3 py-2 align-top text-xs font-semibold whitespace-nowrap text-[var(--workspace-shell-text)]">
          {formatDuration(appGroup.totalDurationSeconds)}
        </TableCell>
        <TableCell className="px-3 py-2 align-top text-xs whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
          {sessionLabel}
        </TableCell>
        <TableCell
          colSpan={showMember ? (selectable ? 7 : 6) : selectable ? 6 : 5}
          className="px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]"
        >
          {appGroup.sessionGroups.length} URL
          {appGroup.sessionGroups.length === 1 ? '' : 's'} · {sessionLabel} ·
          click to {expanded ? 'collapse' : 'expand'}
        </TableCell>
      </TableRow>
      {expanded
        ? appGroup.sessionGroups.map((sessionGroup) => (
            <ActivitySessionGroupRows
              key={`${appGroup.appKey}::${sessionGroup.sessionKey}`}
              sessionGroup={sessionGroup}
              appKey={appGroup.appKey}
              expanded={expandedSessions.has(
                `${appGroup.appKey}::${sessionGroup.sessionKey}`,
              )}
              onToggle={() =>
                onToggleSession(
                  `${appGroup.appKey}::${sessionGroup.sessionKey}`,
                )
              }
              canEdit={canEdit}
              showMember={showMember}
              selectable={selectable}
              selectedBlockIds={selectedBlockIds}
              onSelectedChange={onSelectedChange}
              onGroupSelectedChange={onGroupSelectedChange}
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
  selectable,
  selectedBlockIds,
  onSelectedChange,
  onGroupSelectedChange,
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
  selectable: boolean;
  selectedBlockIds: Set<string>;
  onSelectedChange: (blockId: string, selected: boolean) => void;
  onGroupSelectedChange: (blockIds: string[], selected: boolean) => void;
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
    () =>
      sortActivityAppGroups(groupBlocksByApp(group.blocks), sortKey, sortDir),
    [group.blocks, sortDir, sortKey],
  );
  const [expandedApps, setExpandedApps] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    () => new Set(),
  );
  const selectableBlocks = group.blocks.filter((block) => !block.isExcluded);
  const selectedCount = selectableBlocks.filter((block) =>
    selectedBlockIds.has(block.id),
  ).length;
  const allSelected =
    selectableBlocks.length > 0 && selectedCount === selectableBlocks.length;
  const someSelected =
    selectedCount > 0 && selectedCount < selectableBlocks.length;

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

  function toggleSession(sessionKey: string) {
    setExpandedSessions((current) => {
      const next = new Set(current);

      if (next.has(sessionKey)) {
        next.delete(sessionKey);
      } else {
        next.add(sessionKey);
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
              {selectable ? (
                <TableHead className="h-9 w-10 px-3">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={(checked) =>
                      onGroupSelectedChange(
                        selectableBlocks.map((block) => block.id),
                        checked === true,
                      )
                    }
                    aria-label={`Select all activity on ${group.label}`}
                  />
                </TableHead>
              ) : null}
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
                selectable={selectable}
                selectedBlockIds={selectedBlockIds}
                onSelectedChange={onSelectedChange}
                onGroupSelectedChange={onGroupSelectedChange}
                projects={projects}
                clients={clients}
                accountId={accountId}
                accountSlug={accountSlug}
                onUpdated={onUpdated}
                expandedSessions={expandedSessions}
                onToggleSession={toggleSession}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ActivityBulkActionBar({
  blockIds,
  ruleOptions,
  projects,
  clients,
  accountId,
  accountSlug,
  onClearSelection,
  onUpdatedBlocks,
}: {
  blockIds: string[];
  ruleOptions: ActivityRuleMatch[];
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onClearSelection: () => void;
  onUpdatedBlocks: (
    blockIds: string[],
    update: {
      projectId?: string | null;
      clientId?: string | null;
      isConfirmed?: boolean;
      isExcluded?: boolean;
      workClassification?: WorkClassification;
    },
  ) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState('none');
  const [clientId, setClientId] = useState('none');
  const [workClassification, setWorkClassification] =
    useState<WorkClassification>('neutral');
  const [rememberRule, setRememberRule] = useState(true);
  const [selectedRuleKey, setSelectedRuleKey] = useState(() => {
    const preferredDomain = ruleOptions.find(
      (option) => option.level === 'domain',
    );
    const defaultOption = preferredDomain ?? ruleOptions[0];
    return defaultOption ? activityRuleMatchKey(defaultOption) : '';
  });
  const selectedRule = findActivityRuleMatchByKey(ruleOptions, selectedRuleKey);

  function runBulkAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    update: {
      projectId?: string | null;
      clientId?: string | null;
      isConfirmed?: boolean;
      isExcluded?: boolean;
      workClassification?: WorkClassification;
    },
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        toast.error(result.error ?? 'Update failed');
        return;
      }

      let ruleSaved = false;
      const nextProjectId = update.projectId ?? null;
      const nextClientId = update.clientId ?? null;

      if (
        rememberRule &&
        selectedRule &&
        update.isConfirmed &&
        (nextProjectId || nextClientId)
      ) {
        const ruleResult = await createActivityRuleAction({
          accountId,
          accountSlug,
          matchType: selectedRule.matchType,
          matchValue: selectedRule.matchValue,
          projectId: nextProjectId,
          clientId: nextClientId,
          backfill: true,
        });

        if (ruleResult.success) {
          ruleSaved = true;
          if (ruleResult.backfilled && ruleResult.backfilled > 0) {
            toast.success(
              `Updated ${blockIds.length} sessions and backfilled ${ruleResult.backfilled} more via ${selectedRule.label} rule`,
            );
          } else {
            toast.success(
              `Updated ${blockIds.length} sessions and saved ${selectedRule.label} rule`,
            );
          }
        } else if (ruleResult.error) {
          toast.warning(ruleResult.error);
        }
      }

      if (!ruleSaved) {
        toast.success(
          `Updated ${blockIds.length} activity block${blockIds.length === 1 ? '' : 's'}`,
        );
      }

      onUpdatedBlocks(blockIds, update);
      onClearSelection();
      setProjectId('none');
      setClientId('none');
    });
  }

  return (
    <div className="sticky bottom-4 z-20 mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/95 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
        {blockIds.length} selected
      </p>
      <Select value={clientId} onValueChange={setClientId} disabled={pending}>
        <SelectTrigger className="h-9 w-[10rem] bg-[var(--workspace-control-surface)] text-xs">
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
        <SelectTrigger className="h-9 w-[10rem] bg-[var(--workspace-control-surface)] text-xs">
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
      <Select
        value={workClassification}
        onValueChange={(value) =>
          setWorkClassification(value as WorkClassification)
        }
        disabled={pending}
      >
        <SelectTrigger className="h-9 w-[8.5rem] bg-[var(--workspace-control-surface)] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="billable">Billable</SelectItem>
          <SelectItem value="internal">Internal</SelectItem>
        </SelectContent>
      </Select>
      {ruleOptions.length > 0 ? (
        <ActivityRememberRuleSelector
          options={ruleOptions}
          selectedKey={selectedRuleKey}
          onSelectedKeyChange={setSelectedRuleKey}
          rememberRule={rememberRule}
          onRememberRuleChange={setRememberRule}
          disabled={pending}
        />
      ) : null}
      <Button
        type="button"
        size="sm"
        className="ozer-gradient-btn"
        disabled={pending}
        onClick={() =>
          runBulkAction(
            () =>
              bulkUpdateActivityBlocksAction({
                accountId,
                accountSlug,
                blockIds,
                projectId: projectId === 'none' ? null : projectId,
                clientId: clientId === 'none' ? null : clientId,
                isConfirmed: true,
                workClassification,
              }),
            {
              projectId: projectId === 'none' ? null : projectId,
              clientId: clientId === 'none' ? null : clientId,
              isConfirmed: true,
              workClassification,
            },
          )
        }
      >
        {pending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-3.5 w-3.5" />
        )}
        Assign & confirm
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          runBulkAction(
            () =>
              bulkExcludeActivityBlocksAction({
                accountId,
                accountSlug,
                blockIds,
              }),
            { isExcluded: true },
          )
        }
      >
        <Ban className="mr-1.5 h-3.5 w-3.5" />
        Exclude
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={onClearSelection}
      >
        Clear
      </Button>
    </div>
  );
}

export function ActivityPageContent({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(data.blocks);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [sortKey, setSortKey] = useState<ActivitySortKey>('duration');
  const [sortDir, setSortDir] = useState<ActivitySortDir>('desc');

  useEffect(() => {
    setRows(data.blocks);
    setSelectedBlockIds(new Set());
  }, [data.blocks]);

  const selectable = data.canEdit;
  const selectedIds = useMemo(() => [...selectedBlockIds], [selectedBlockIds]);
  const selectedBlocks = useMemo(
    () => rows.filter((row) => selectedBlockIds.has(row.id)),
    [rows, selectedBlockIds],
  );
  const bulkRuleOptions = useMemo(
    () => intersectActivityRuleMatchOptions(selectedBlocks),
    [selectedBlocks],
  );

  const reportsPath = `${workAccountPath(
    pathsConfig.app.accountActivityReports,
    data.accountSlug,
  )}?${new URLSearchParams({
    from: data.dateFrom,
    to: data.dateTo,
    view: data.view,
  }).toString()}`;

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
  const countSuffix = data.blockLimitReached ? '+' : '';
  const topUnassignedApps = useMemo(() => {
    const unassigned = rows.filter(
      (block) =>
        !block.isExcluded &&
        !block.isConfirmed &&
        !block.projectId &&
        !block.clientId,
    );
    return aggregateActivityByApp(unassigned).slice(0, 3);
  }, [rows]);
  const reviewHref = buildActivityUrl(data.accountSlug, {
    from: data.dateFrom,
    to: data.dateTo,
    view: data.view,
    status: 'needs_review',
    layout: 'list',
    date: data.focusDate,
  });
  const [suggestPending, startSuggestTransition] = useTransition();

  function onSuggestAssignments() {
    const targets = rows
      .filter(
        (block) =>
          !block.isExcluded &&
          !block.isConfirmed &&
          !block.projectId &&
          !block.clientId,
      )
      .slice(0, 40)
      .map((block) => block.id);

    if (targets.length === 0) {
      toast.message('No unassigned sessions to suggest for');
      return;
    }

    startSuggestTransition(async () => {
      const result = await suggestActivityAssignmentsAction({
        accountId: data.accountId,
        accountSlug: data.accountSlug,
        blockIds: targets,
      });

      if (!result.success || !result.suggestions?.length) {
        toast.error(result.error ?? 'No suggestions returned');
        return;
      }

      const applyResult = await applyActivitySuggestionsAction({
        accountId: data.accountId,
        accountSlug: data.accountSlug,
        suggestions: result.suggestions,
        rememberRules: true,
      });

      if (!applyResult.success) {
        toast.error(applyResult.error ?? 'Could not apply suggestions');
        return;
      }

      toast.success(`Applied ${applyResult.applied} AI suggestions`);
      router.refresh();
    });
  }

  function updateBlock(updated: ActivityBlockListRow) {
    setRows((current) =>
      current.map((row) => (row.id === updated.id ? updated : row)),
    );
    router.refresh();
  }

  function updateSelectedBlock(blockId: string, selected: boolean) {
    setSelectedBlockIds((current) => {
      const next = new Set(current);

      if (selected) {
        next.add(blockId);
      } else {
        next.delete(blockId);
      }

      return next;
    });
  }

  function updateSelectedBlocks(blockIds: string[], selected: boolean) {
    setSelectedBlockIds((current) => {
      const next = new Set(current);

      for (const blockId of blockIds) {
        if (selected) {
          next.add(blockId);
        } else {
          next.delete(blockId);
        }
      }

      return next;
    });
  }

  function updateBulkBlocks(
    blockIds: string[],
    update: {
      projectId?: string | null;
      clientId?: string | null;
      isConfirmed?: boolean;
      isExcluded?: boolean;
      workClassification?: WorkClassification;
    },
  ) {
    const projectName =
      update.projectId == null
        ? null
        : (data.projects.find((project) => project.id === update.projectId)
            ?.name ?? null);
    const clientName =
      update.clientId == null
        ? null
        : (data.clients.find((client) => client.id === update.clientId)?.name ??
          null);

    setRows((current) =>
      current.map((row) => {
        if (!blockIds.includes(row.id)) {
          return row;
        }

        return {
          ...row,
          projectId:
            update.projectId !== undefined ? update.projectId : row.projectId,
          clientId:
            update.clientId !== undefined ? update.clientId : row.clientId,
          projectName:
            update.projectId !== undefined ? projectName : row.projectName,
          clientName:
            update.clientId !== undefined ? clientName : row.clientName,
          isConfirmed:
            update.isConfirmed !== undefined
              ? update.isConfirmed
              : row.isConfirmed,
          isExcluded:
            update.isExcluded !== undefined
              ? update.isExcluded
              : row.isExcluded,
          workClassification:
            update.workClassification !== undefined
              ? update.workClassification
              : row.workClassification,
        };
      }),
    );
    router.refresh();
  }

  function navigate(next: {
    from?: string;
    to?: string;
    view?: 'mine' | 'team';
    status?: ActivityStatusFilter;
    layout?: ActivityLayoutMode;
    date?: string;
  }) {
    startTransition(() => {
      router.push(
        buildActivityUrl(data.accountSlug, {
          from: next.from ?? data.dateFrom,
          to: next.to ?? data.dateTo,
          view: next.view ?? data.view,
          status: next.status ?? data.statusFilter,
          layout: next.layout ?? data.layoutMode,
          date: next.date ?? data.focusDate,
        }),
      );
    });
  }

  function onDateRangeApply(
    from: string,
    to: string,
    _selection: DateRangeSelection,
  ) {
    navigate({ from, to });
  }

  const isListLayout = data.layoutMode === 'list';
  const layoutTotalDuration = useMemo(() => sumActiveDuration(rows), [rows]);

  return (
    <div
      className={cn(
        'space-y-6 pb-6 transition-opacity duration-200',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      {isListLayout ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Today
            </p>
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
      ) : null}

      {isListLayout ? (
        <ActivityReviewDigest
          assignment={data.assignment}
          topUnassignedApps={topUnassignedApps}
          reviewHref={reviewHref}
          onSuggest={data.canEdit ? onSuggestAssignments : undefined}
          suggestPending={suggestPending}
        />
      ) : null}

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
          {isListLayout ? (
            <AnalyticsDateRangePicker
              fromIso={data.dateFrom}
              toIso={data.dateTo}
              isLoading={isPending}
              onApply={onDateRangeApply}
            />
          ) : null}
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={reportsPath}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports
            </Link>
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={settingsPath}>
              <Settings2 className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <ActivityLayoutNav
        layoutMode={data.layoutMode}
        focusDate={data.focusDate}
        dateFrom={data.dateFrom}
        dateTo={data.dateTo}
        totalDurationSeconds={layoutTotalDuration}
        isPending={isPending}
        onLayoutChange={(layout) =>
          navigate({
            layout,
            status: layout === 'list' ? data.statusFilter : 'all',
          })
        }
        onFocusDateChange={(date) =>
          navigate({ date, layout: data.layoutMode })
        }
        onShiftFocusDate={(deltaDays) =>
          navigate({
            date: shiftActivityFocusDate(data.focusDate, deltaDays),
            layout: data.layoutMode,
          })
        }
      />

      {isListLayout ? (
        <Tabs
          value={data.statusFilter}
          onValueChange={(value) =>
            navigate({
              status: value as ActivityStatusFilter,
            })
          }
        >
          <TabsList className="bg-[var(--workspace-shell-panel)]">
            <TabsTrigger value="all">
              All ({data.assignment.totalSessionCount}
              {countSuffix})
            </TabsTrigger>
            <TabsTrigger value="needs_review">
              Needs review ({data.assignment.needsReviewSessionCount}
              {countSuffix})
            </TabsTrigger>
            <TabsTrigger value="unassigned">
              Unassigned ({data.assignment.unassignedSessionCount}
              {countSuffix})
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              Confirmed ({data.assignment.confirmedSessionCount}
              {countSuffix})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {data.blockLimitReached ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Showing the most recent {data.blocks.length.toLocaleString()} focus
          changes ({data.assignment.totalSessionCount.toLocaleString()} grouped
          sessions) in this range. Narrow the date range or use a status filter
          to triage faster.
        </p>
      ) : null}

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
              <Button asChild size="sm" className="ozer-gradient-btn">
                <Link href={settingsPath}>Open activity settings</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 && data.layoutMode === 'list' ? (
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
      ) : data.layoutMode === 'day' ? (
        <ActivityDayView
          blocks={rows}
          focusDate={data.focusDate}
          showMember={data.view === 'team'}
          canEdit={data.canEdit}
          projects={data.projects}
          clients={data.clients}
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          onUpdated={updateBlock}
        />
      ) : data.layoutMode === 'week' ? (
        <ActivityWeekView
          data={data}
          blocks={rows}
          focusDate={data.focusDate}
          onSelectDay={(dayKey) => navigate({ layout: 'day', date: dayKey })}
        />
      ) : rows.length === 0 ? null : (
        <div className="space-y-5 pb-4">
          {dayGroups.map((group) => (
            <ActivityDayTable
              key={group.dayKey}
              group={group}
              canEdit={data.canEdit}
              showMember={data.view === 'team'}
              selectable={selectable}
              selectedBlockIds={selectedBlockIds}
              onSelectedChange={updateSelectedBlock}
              onGroupSelectedChange={updateSelectedBlocks}
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
          {selectable && selectedIds.length > 0 ? (
            <ActivityBulkActionBar
              blockIds={selectedIds}
              ruleOptions={bulkRuleOptions}
              projects={data.projects}
              clients={data.clients}
              accountId={data.accountId}
              accountSlug={data.accountSlug}
              onClearSelection={() => setSelectedBlockIds(new Set())}
              onUpdatedBlocks={updateBulkBlocks}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
