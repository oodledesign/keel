'use client';

import { useMemo, useState } from 'react';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import { blockContextLabel } from '~/lib/activity/activity-app-context';
import {
  type ActivityAppGroup,
  type ActivityBlockListRow,
  aggregateActivityByApp,
  aggregateActivityByClient,
  aggregateActivityByProject,
  blockTimelinePosition,
  filterBlocksForDay,
  formatActivityFocusDateLabel,
  formatDuration,
  formatTimeRange,
  groupBlocksByApp,
  sumActiveDuration,
} from '~/lib/activity/activity-history';

import { ActivityBlockAssignmentCell } from './activity-block-assignment-cell';
import { ActivityAppIcon } from './activity-app-icon';
import { ActivitySummaryBreakdown } from './activity-summary-breakdown';

type Props = {
  blocks: ActivityBlockListRow[];
  focusDate: string;
  showMember: boolean;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
};

const TIMELINE_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function TimelineBlock({
  block,
  focusDate,
}: {
  block: ActivityBlockListRow;
  focusDate: string;
}) {
  const position = blockTimelinePosition(block, focusDate);

  if (!position || block.isExcluded) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute right-1 left-8 overflow-hidden rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/80 px-1.5 py-0.5 shadow-sm',
        block.isConfirmed && 'border-emerald-500/30 bg-emerald-500/10',
      )}
      style={{
        top: `${position.topPercent}%`,
        height: `${position.heightPercent}%`,
        minHeight: '1.25rem',
      }}
      title={`${block.appName} · ${formatDuration(block.durationSeconds)}`}
    >
      <div className="flex min-w-0 items-center gap-1">
        <ActivityAppIcon block={block} />
        <span className="truncate text-[10px] font-medium text-[var(--workspace-shell-text)]">
          {block.appName}
        </span>
      </div>
    </div>
  );
}

function MemoryFeedItem({
  block,
  showMember,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
  nested = false,
}: {
  block: ActivityBlockListRow;
  showMember: boolean;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
  nested?: boolean;
}) {
  const context = blockContextLabel(block);

  return (
    <article
      className={cn(
        'flex gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 transition-colors hover:bg-[var(--workspace-control-surface)]/20',
        nested
          ? 'border-transparent bg-[var(--workspace-control-surface)]/15'
          : 'bg-[var(--workspace-shell-panel)]',
        block.isExcluded && 'opacity-50',
      )}
    >
      {nested ? (
        <span className="mt-1 w-4 shrink-0 text-center text-xs text-[var(--workspace-shell-text-muted)]">
          ↳
        </span>
      ) : (
        <ActivityAppIcon block={block} size="md" className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-medium text-[var(--workspace-shell-text)]"
              title={context}
            >
              {context}
            </p>
            {!nested ? (
              <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                {block.appName}
                {showMember && block.userName ? ` · ${block.userName}` : ''}
              </p>
            ) : showMember && block.userName ? (
              <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                {block.userName}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {formatDuration(block.durationSeconds)}
            </p>
            <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
              {formatTimeRange(block.startedAt, block.endedAt)}
            </p>
          </div>
        </div>

        <ActivityBlockAssignmentCell
          block={block}
          canEdit={canEdit}
          projects={projects}
          clients={clients}
          accountId={accountId}
          accountSlug={accountSlug}
          onUpdated={onUpdated}
          triggerClassName="w-full rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-2 py-1.5 hover:border-[color:var(--ozer-accent)]/40"
          popoverAlign="end"
        />
      </div>
    </article>
  );
}

function MemoryAppGroup({
  appGroup,
  expanded,
  onToggle,
  showMember,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  appGroup: ActivityAppGroup;
  expanded: boolean;
  onToggle: () => void;
  showMember: boolean;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const representativeBlock = appGroup.blocks[0]!;
  const primaryLabel = appGroup.domainLabel ?? appGroup.appName;
  const sessionLabel = `${appGroup.blocks.length} session${appGroup.blocks.length === 1 ? '' : 's'}`;
  const sortedBlocks = useMemo(
    () =>
      [...appGroup.blocks].sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      ),
    [appGroup.blocks],
  );
  const isSingleBlock = appGroup.blocks.length === 1;

  if (isSingleBlock) {
    return (
      <MemoryFeedItem
        block={representativeBlock}
        showMember={showMember}
        canEdit={canEdit}
        projects={projects}
        clients={clients}
        accountId={accountId}
        accountSlug={accountSlug}
        onUpdated={onUpdated}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--workspace-control-surface)]/30"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        )}
        <ActivityAppIcon block={representativeBlock} size="md" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]"
            title={primaryLabel}
          >
            {primaryLabel}
          </p>
          {appGroup.domainLabel ? (
            <p
              className="truncate text-xs text-[var(--workspace-shell-text-muted)]"
              title={appGroup.appName}
            >
              {appGroup.appName}
            </p>
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {sessionLabel}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {formatDuration(appGroup.totalDurationSeconds)}
          </p>
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
            {sessionLabel}
          </p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-1 border-t border-[color:var(--workspace-shell-border)] px-2 py-2">
          {sortedBlocks.map((block) => (
            <MemoryFeedItem
              key={block.id}
              block={block}
              showMember={showMember}
              canEdit={canEdit}
              projects={projects}
              clients={clients}
              accountId={accountId}
              accountSlug={accountSlug}
              onUpdated={onUpdated}
              nested
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ActivityDayView({
  blocks,
  focusDate,
  showMember,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: Props) {
  const dayBlocks = useMemo(
    () =>
      filterBlocksForDay(blocks, focusDate).filter((block) => !block.isExcluded),
    [blocks, focusDate],
  );
  const dayTotal = useMemo(() => sumActiveDuration(dayBlocks), [dayBlocks]);
  const topApps = useMemo(
    () => aggregateActivityByApp(dayBlocks),
    [dayBlocks],
  );
  const topClients = useMemo(
    () => aggregateActivityByClient(dayBlocks),
    [dayBlocks],
  );
  const topProjects = useMemo(
    () => aggregateActivityByProject(dayBlocks),
    [dayBlocks],
  );
  const timelineBlocks = useMemo(
    () =>
      groupBlocksByApp(dayBlocks)
        .flatMap((group) => group.blocks)
        .sort((left, right) => left.startedAt.localeCompare(right.startedAt)),
    [dayBlocks],
  );
  const appGroups = useMemo(() => groupBlocksByApp(dayBlocks), [dayBlocks]);
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleAppGroup(appKey: string) {
    setCollapsedApps((current) => {
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
    <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="grid min-h-[36rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-[color:var(--workspace-shell-border)] lg:border-r lg:border-b-0">
          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Timesheet
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
              {formatDuration(dayTotal)}
            </p>
          </div>

          <div className="relative h-72 overflow-hidden border-b border-[color:var(--workspace-shell-border)]">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="relative min-h-[48rem] px-3 py-2">
                {TIMELINE_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="relative h-8 border-t border-[color:var(--workspace-shell-border)]/50 first:border-t-0"
                  >
                    <span className="absolute top-0 left-0 text-[10px] text-[var(--workspace-shell-text-muted)]">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
                {timelineBlocks.map((block) => (
                  <TimelineBlock
                    key={block.id}
                    block={block}
                    focusDate={focusDate}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <ActivitySummaryBreakdown
              title="Top clients"
              rows={topClients}
              emptyLabel="No client time logged"
              accentClassName="bg-sky-500"
            />
            <ActivitySummaryBreakdown
              title="Top projects"
              rows={topProjects}
              emptyLabel="No project time logged"
              accentClassName="bg-violet-500"
            />
          </div>
        </aside>

        <section className="flex min-h-[36rem] flex-col">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Memory
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Where you spent your time on{' '}
                {formatActivityFocusDateLabel(focusDate).toLowerCase()}
              </p>
            </div>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {dayBlocks.length} session{dayBlocks.length === 1 ? '' : 's'} ·{' '}
              {appGroups.length} app{appGroups.length === 1 ? '' : 's'}
            </p>
          </header>

          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <ActivitySummaryBreakdown
              title="Most used apps"
              rows={topApps}
              emptyLabel="No app activity yet"
              maxRows={6}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {appGroups.length === 0 ? (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 text-center">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  No time logged
                </p>
                <p className="mt-1 max-w-sm text-xs text-[var(--workspace-shell-text-muted)]">
                  Activity from KeelAssistant will appear here once synced for
                  this day.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {appGroups.map((appGroup) => (
                  <MemoryAppGroup
                    key={appGroup.appKey}
                    appGroup={appGroup}
                    expanded={!collapsedApps.has(appGroup.appKey)}
                    onToggle={() => toggleAppGroup(appGroup.appKey)}
                    showMember={showMember}
                    canEdit={canEdit}
                    projects={projects}
                    clients={clients}
                    accountId={accountId}
                    accountSlug={accountSlug}
                    onUpdated={onUpdated}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
