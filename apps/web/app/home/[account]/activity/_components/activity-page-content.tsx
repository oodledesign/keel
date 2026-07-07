'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Activity,
  Ban,
  Check,
  Loader2,
  MoreHorizontal,
  Settings2,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
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
import {
  excludeActivityBlockAction,
  updateActivityBlockAction,
} from '~/home/[account]/activity/_lib/server/activity-blocks-actions';
import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  blockPageTitle,
  blockStatusLabel,
  blockStatusText,
  blockUrlLabel,
  formatDuration,
  formatTimeRange,
  groupBlocksByDay,
  sumActiveDuration,
  sumTodayActiveDuration,
  type ActivityBlockListRow,
  type ActivityDayGroup,
  type ActivityRangeKey,
} from '~/lib/activity/activity-history';

type Props = {
  data: ActivityPageData;
};

const RANGE_OPTIONS: Array<{ value: ActivityRangeKey; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

function statusBadgeClass(status: ReturnType<typeof blockStatusLabel>) {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'suggested':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
    case 'excluded':
      return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
}

function buildActivityUrl(
  accountSlug: string,
  params: { range: ActivityRangeKey; view: 'mine' | 'team' },
) {
  const search = new URLSearchParams({
    range: params.range,
    view: params.view,
  });

  return `${workAccountPath(pathsConfig.app.accountActivity, accountSlug)}?${search.toString()}`;
}

function assignmentLabel(block: ActivityBlockListRow): string {
  return [block.projectName, block.clientName].filter(Boolean).join(' · ') || '—';
}

function ActivityBlockActions({
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
    });
  }

  if (!canEdit || block.isExcluded) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Assign block
        </p>
        <div className="space-y-2">
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
            <Check className="mr-1.5 h-3.5 w-3.5" />
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

function ActivityDayTable({
  group,
  canEdit,
  showMember,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
}: {
  group: ActivityDayGroup;
  canEdit: boolean;
  showMember: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
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
              <TableHead className="h-9 px-3 text-xs">Time</TableHead>
              <TableHead className="h-9 px-3 text-xs">Dur</TableHead>
              <TableHead className="h-9 px-3 text-xs">App</TableHead>
              <TableHead className="h-9 px-3 text-xs">Page</TableHead>
              <TableHead className="h-9 px-3 text-xs">URL / domain</TableHead>
              {showMember ? (
                <TableHead className="h-9 px-3 text-xs">Member</TableHead>
              ) : null}
              <TableHead className="h-9 px-3 text-xs">Assignment</TableHead>
              <TableHead className="h-9 px-3 text-xs">Status</TableHead>
              <TableHead className="h-9 w-10 px-2 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.blocks.map((block) => {
              const status = blockStatusLabel(block);
              const pageTitle = blockPageTitle(block);
              const urlLabel = blockUrlLabel(block);

              return (
                <TableRow
                  key={block.id}
                  className={cn(
                    'border-[color:var(--workspace-shell-border)] text-sm',
                    block.isExcluded && 'opacity-50',
                  )}
                >
                  <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs text-[var(--workspace-shell-text-muted)]">
                    {formatTimeRange(block.startedAt, block.endedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 align-top text-xs font-medium text-[var(--workspace-shell-text)]">
                    {formatDuration(block.durationSeconds)}
                  </TableCell>
                  <TableCell className="max-w-[7rem] px-3 py-2 align-top">
                    <span
                      className="block truncate text-xs text-[var(--workspace-shell-text)]"
                      title={block.appName}
                    >
                      {block.appName}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[14rem] px-3 py-2 align-top">
                    <span
                      className="block truncate text-xs text-[var(--workspace-shell-text)]"
                      title={pageTitle}
                    >
                      {pageTitle}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[16rem] px-3 py-2 align-top">
                    {urlLabel ? (
                      block.url ? (
                        <a
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-sky-300 hover:underline"
                          title={urlLabel}
                        >
                          {urlLabel}
                        </a>
                      ) : (
                        <span
                          className="block truncate text-xs text-[var(--workspace-shell-text-muted)]"
                          title={urlLabel}
                        >
                          {urlLabel}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                        —
                      </span>
                    )}
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
                  <TableCell className="max-w-[10rem] px-3 py-2 align-top">
                    <span
                      className="block truncate text-xs text-[var(--workspace-shell-text-muted)]"
                      title={assignmentLabel(block)}
                    >
                      {assignmentLabel(block)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] font-normal', statusBadgeClass(status))}
                    >
                      {blockStatusText(status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-2 align-top">
                    <ActivityBlockActions
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
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function ActivityPageContent({ data }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(data.blocks);

  useEffect(() => {
    setRows(data.blocks);
  }, [data.blocks]);

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

  function navigate(next: { range?: ActivityRangeKey; view?: 'mine' | 'team' }) {
    router.push(
      buildActivityUrl(data.accountSlug, {
        range: next.range ?? data.range,
        view: next.view ?? data.view,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">Blocks</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {rows.length}
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
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={data.range === option.value ? 'default' : 'outline'}
              className={
                data.range === option.value ? 'keel-gradient-btn' : undefined
              }
              onClick={() => navigate({ range: option.value })}
            >
              {option.label}
            </Button>
          ))}
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
        <div className="space-y-5">
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
              onUpdated={updateBlock}
            />
          ))}
        </div>
      )}
    </div>
  );
}
