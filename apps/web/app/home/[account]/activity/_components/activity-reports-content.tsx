'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, BarChart3 } from 'lucide-react';

import { Button } from '@kit/ui/button';
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

import { AnalyticsDateRangePicker } from '~/components/date-range/analytics-date-range-picker';
import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import type { ActivityReportsData } from '~/home/[account]/activity/_lib/server/activity-reports.loader';
import {
  ACTIVITY_REPORT_UNASSIGNED,
  formatDuration,
  type ActivityReportRow,
} from '~/lib/activity/activity-history';
import type { DateRangeSelection } from '~/lib/date-range/analytics-date-range';

type Props = {
  data: ActivityReportsData;
};

function buildReportsUrl(
  accountSlug: string,
  params: {
    from: string;
    to: string;
    view: 'mine' | 'team';
    client?: string | null;
    project?: string | null;
    member?: string | null;
    app?: string | null;
  },
) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    view: params.view,
  });

  if (params.client) search.set('client', params.client);
  if (params.project) search.set('project', params.project);
  if (params.member) search.set('member', params.member);
  if (params.app) search.set('app', params.app);

  return `${workAccountPath(pathsConfig.app.accountActivityReports, accountSlug)}?${search.toString()}`;
}

function ActivityReportTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: ActivityReportRow[];
  emptyLabel: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-semibold text-[var(--workspace-shell-text)]">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
            {emptyLabel}
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-[var(--workspace-shell-sidebar-accent)]">
              <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
                <TableHead className="h-9 px-3 text-xs">Name</TableHead>
                <TableHead className="h-9 px-3 text-xs">Sessions</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-[color:var(--workspace-shell-border)]"
                >
                  <TableCell className="max-w-[16rem] px-3 py-2 text-sm text-[var(--workspace-shell-text)]">
                    <span className="block truncate" title={row.label}>
                      {row.label}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
                    {row.blockCount}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium text-[var(--workspace-shell-text)]">
                    {formatDuration(row.durationSeconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

export function ActivityReportsContent({ data }: Props) {
  const router = useRouter();
  const activityPath = workAccountPath(
    pathsConfig.app.accountActivity,
    data.accountSlug,
  );

  function navigate(next: {
    from?: string;
    to?: string;
    view?: 'mine' | 'team';
    client?: string | null;
    project?: string | null;
    member?: string | null;
    app?: string | null;
  }) {
    router.push(
      buildReportsUrl(data.accountSlug, {
        from: next.from ?? data.dateFrom,
        to: next.to ?? data.dateTo,
        view: next.view ?? data.view,
        client:
          next.client === undefined ? data.filters.clientId : next.client,
        project:
          next.project === undefined ? data.filters.projectId : next.project,
        member:
          next.member === undefined ? data.filters.memberId : next.member,
        app: next.app === undefined ? data.filters.appKey : next.app,
      }),
    );
  }

  function onDateRangeApply(from: string, to: string, _selection: DateRangeSelection) {
    navigate({ from, to });
  }

  const filterValue = (value: string | null) => value ?? 'all';

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild type="button" size="sm" variant="ghost">
          <Link href={activityPath}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to activity
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Total tracked time
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {formatDuration(data.totalDurationSeconds)}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Sessions in range
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {data.blockCount}
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

        <AnalyticsDateRangePicker
          fromIso={data.dateFrom}
          toIso={data.dateTo}
          onApply={onDateRangeApply}
        />
      </div>

      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Filter report
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Client
            </p>
            <Select
              value={filterValue(data.filters.clientId)}
              onValueChange={(value) =>
                navigate({
                  client: value === 'all' ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value={ACTIVITY_REPORT_UNASSIGNED}>
                  Unassigned
                </SelectItem>
                {data.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Project
            </p>
            <Select
              value={filterValue(data.filters.projectId)}
              onValueChange={(value) =>
                navigate({
                  project: value === 'all' ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value={ACTIVITY_REPORT_UNASSIGNED}>
                  Unassigned
                </SelectItem>
                {data.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              App / website
            </p>
            <Select
              value={filterValue(data.filters.appKey)}
              onValueChange={(value) =>
                navigate({
                  app: value === 'all' ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
                <SelectValue placeholder="All apps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps & websites</SelectItem>
                {data.apps.map((app) => (
                  <SelectItem key={app.key} value={app.key}>
                    {app.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.view === 'team' ? (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Team member
              </p>
              <Select
                value={filterValue(data.filters.memberId)}
                onValueChange={(value) =>
                  navigate({
                    member: value === 'all' ? null : value,
                  })
                }
              >
                <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {data.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ActivityReportTable
          title="By client"
          rows={data.byClient}
          emptyLabel="No client time in this range."
        />
        <ActivityReportTable
          title="By project"
          rows={data.byProject}
          emptyLabel="No project time in this range."
        />
        <ActivityReportTable
          title="By app / website"
          rows={data.byApp}
          emptyLabel="No app time in this range."
        />
        {data.view === 'team' ? (
          <ActivityReportTable
            title="By team member"
            rows={data.byMember}
            emptyLabel="No team activity in this range."
          />
        ) : null}
      </div>
    </div>
  );
}
