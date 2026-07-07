'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Activity, Ban, Check, Loader2, Settings2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
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
  blockPrimaryLabel,
  blockStatusLabel,
  blockStatusText,
  formatDuration,
  formatTimeRange,
  groupBlocksByDay,
  sumActiveDuration,
  sumTodayActiveDuration,
  type ActivityBlockListRow,
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

function ActivityBlockRow({
  block,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  showMember,
  onUpdated,
}: {
  block: ActivityBlockListRow;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  showMember: boolean;
  onUpdated: (block: ActivityBlockListRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(block.projectId ?? 'none');
  const [clientId, setClientId] = useState(block.clientId ?? 'none');
  const status = blockStatusLabel(block);

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

  return (
    <div
      className={cn(
        'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4',
        block.isExcluded && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[var(--workspace-shell-text)]">
              {block.appName}
            </p>
            <Badge variant="outline" className={statusBadgeClass(status)}>
              {blockStatusText(status)}
            </Badge>
          </div>
          <p className="truncate text-sm text-[var(--workspace-shell-text-muted)]">
            {blockPrimaryLabel(block)}
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {formatTimeRange(block.startedAt, block.endedAt)} ·{' '}
            {formatDuration(block.durationSeconds)}
            {showMember && block.userName ? ` · ${block.userName}` : null}
          </p>
          {(block.projectName || block.clientName) && (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {[block.projectName, block.clientName].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {canEdit && !block.isExcluded ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <p className="mb-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Project
            </p>
            <Select value={projectId} onValueChange={setProjectId} disabled={pending}>
              <SelectTrigger className="bg-[var(--workspace-control-surface)]">
                <SelectValue placeholder="No project" />
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

          <div className="min-w-[10rem] flex-1">
            <p className="mb-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Client
            </p>
            <Select value={clientId} onValueChange={setClientId} disabled={pending}>
              <SelectTrigger className="bg-[var(--workspace-control-surface)]">
                <SelectValue placeholder="No client" />
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

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              className="keel-gradient-btn"
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
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
              <Ban className="mr-2 h-4 w-4" />
              Exclude
            </Button>
          </div>
        </div>
      ) : null}
    </div>
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
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Blocks
          </p>
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
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <section key={group.dayKey} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
                  {group.label}
                </h2>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {formatDuration(group.totalDurationSeconds)}
                </p>
              </div>
              <div className="space-y-3">
                {group.blocks.map((block) => (
                  <ActivityBlockRow
                    key={block.id}
                    block={block}
                    canEdit={data.canEdit}
                    projects={data.projects}
                    clients={data.clients}
                    accountId={data.accountId}
                    accountSlug={data.accountSlug}
                    showMember={data.view === 'team'}
                    onUpdated={updateBlock}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
