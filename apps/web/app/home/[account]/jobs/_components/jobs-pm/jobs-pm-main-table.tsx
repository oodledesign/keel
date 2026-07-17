'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
} from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../../_lib/error-message';
import { updateJob } from '../../_lib/server/server-actions';
import {
  JOB_STATUS_CELL,
  type JobPriority,
  type JobStatus,
  PHASE_CELL,
  PRIORITY_CELL,
  PROJECT_GROUPS,
  type ProjectGroupId,
  formatTimelineRange,
  formatValue,
  getProjectGroupId,
  truncateText,
} from './jobs-pm.constants';

export type JobsPmRow = {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  value_pence: number | null;
  assignment_count: number;
  assignees: { user_id: string; role_on_job: string | null }[];
  clients?: { display_name: string | null } | null;
};

type MemberPreview = {
  user_id: string;
  name: string | null;
  email: string | null;
  picture_url?: string | null;
};

export function JobsPmMainTable({
  jobs,
  accountSlug,
  accountId,
  canEditJobs,
  isContractorView,
  members,
  onRefresh,
  onAddProject,
  uiVariant,
}: {
  jobs: JobsPmRow[];
  accountSlug: string;
  accountId: string;
  canEditJobs: boolean;
  isContractorView: boolean;
  members: MemberPreview[];
  onRefresh: () => void;
  onAddProject: () => void;
  uiVariant: 'projects' | 'maintenance';
}) {
  const [collapsed, setCollapsed] = useState<Record<ProjectGroupId, boolean>>(
    {},
  );
  const [, startTransition] = useTransition();

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  const grouped = useMemo(() => {
    return PROJECT_GROUPS.map((group) => ({
      ...group,
      jobs: jobs.filter((job) =>
        group.statuses.includes(job.status as JobStatus),
      ),
    })).filter((group) => group.jobs.length > 0);
  }, [jobs]);

  const jobDetailPath = pathsConfig.app.accountJobDetail.replace(
    '[account]',
    accountSlug,
  );

  const handleStatusChange = (jobId: string, status: JobStatus) => {
    if (!canEditJobs) return;
    startTransition(async () => {
      try {
        await updateJob({ accountId, jobId, status });
        onRefresh();
        toast.success('Status updated');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  const handlePriorityChange = (jobId: string, priority: JobPriority) => {
    if (!canEditJobs) return;
    startTransition(async () => {
      try {
        await updateJob({ accountId, jobId, priority });
        onRefresh();
        toast.success('Priority updated');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  const projectLabel = uiVariant === 'maintenance' ? 'Job' : 'Project';

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {grouped.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        const phaseStyle = PHASE_CELL[group.id];

        return (
          <section key={group.id} className="mb-1">
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [group.id]: !isCollapsed,
                }))
              }
              className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-4 py-2.5 text-left md:px-5"
              style={{ borderLeftWidth: 4, borderLeftColor: group.accent }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
              )}
              <span className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                {group.label}
              </span>
              <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {group.jobs.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                      <th className="w-[220px] px-4 py-2 md:px-5">
                        {projectLabel}
                      </th>
                      <th className="w-[72px] px-2 py-2">PM</th>
                      <th className="min-w-[180px] px-2 py-2">Overview</th>
                      <th className="w-[140px] px-2 py-2">Status</th>
                      <th className="w-[100px] px-2 py-2">Priority</th>
                      <th className="w-[110px] px-2 py-2">Phase</th>
                      <th className="w-[140px] px-2 py-2">Timeline</th>
                      {!isContractorView && (
                        <th className="w-[80px] px-2 py-2">Value</th>
                      )}
                      <th className="w-[56px] px-2 py-2 md:pr-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.jobs.map((job) => {
                      const primaryAssignee = job.assignees[0];
                      const member = primaryAssignee
                        ? memberById.get(primaryAssignee.user_id)
                        : null;
                      const statusStyle =
                        JOB_STATUS_CELL[job.status as JobStatus] ??
                        JOB_STATUS_CELL.pending;
                      const priorityStyle =
                        PRIORITY_CELL[job.priority as JobPriority] ??
                        PRIORITY_CELL.medium;
                      const groupId = getProjectGroupId(job.status);
                      const rowPhase = PHASE_CELL[groupId];

                      return (
                        <tr
                          key={job.id}
                          className="group border-b border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        >
                          <td className="px-4 py-1.5 md:px-5">
                            <Link
                              href={jobDetailPath.replace('[id]', job.id)}
                              className="flex items-center gap-2 font-medium text-[var(--workspace-shell-text)] hover:text-[#579bfc]"
                            >
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[10px] text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                                +
                              </span>
                              {job.title}
                            </Link>
                            {job.clients?.display_name && (
                              <p className="mt-0.5 pl-7 text-xs text-[var(--workspace-shell-text-muted)]">
                                {job.clients.display_name}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {member ? (
                              <span
                                title={
                                  primaryAssignee?.role_on_job
                                    ? `${primaryAssignee.role_on_job}: ${member.name ?? member.email}`
                                    : (member.name ?? member.email ?? '')
                                }
                              >
                                <ProfileAvatar
                                  displayName={
                                    member.name ?? member.email ?? '?'
                                  }
                                  pictureUrl={member.picture_url}
                                  className="mx-0 h-7 w-7 ring-2 ring-[var(--workspace-shell-canvas)]"
                                />
                              </span>
                            ) : job.assignment_count > 0 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--workspace-shell-panel-hover)] text-[10px] text-[var(--workspace-shell-text-muted)]">
                                +{job.assignment_count}
                              </span>
                            ) : (
                              <span className="text-[var(--workspace-shell-text-muted)]">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                            {truncateText(job.description)}
                          </td>
                          <td className="px-2 py-1.5">
                            {canEditJobs ? (
                              <Select
                                value={job.status}
                                onValueChange={(v) =>
                                  handleStatusChange(job.id, v as JobStatus)
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-full border-0 px-2 text-xs font-medium shadow-none focus:ring-0"
                                  style={{
                                    backgroundColor: statusStyle.bg,
                                    color: statusStyle.text,
                                  }}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(JOB_STATUS_CELL).map(
                                    ([key, val]) => (
                                      <SelectItem key={key} value={key}>
                                        {val.label}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              <StatusPill style={statusStyle} />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {canEditJobs ? (
                              <Select
                                value={job.priority}
                                onValueChange={(v) =>
                                  handlePriorityChange(job.id, v as JobPriority)
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-full border-0 px-2 text-xs font-medium shadow-none focus:ring-0"
                                  style={{
                                    backgroundColor: priorityStyle.bg,
                                    color: priorityStyle.text,
                                  }}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PRIORITY_CELL).map(
                                    ([key, val]) => (
                                      <SelectItem key={key} value={key}>
                                        {val.label}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              <StatusPill style={priorityStyle} />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <StatusPill style={rowPhase} />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="inline-flex rounded-md bg-[var(--workspace-control-surface)]/80 px-2 py-1 text-xs text-[var(--workspace-shell-text-muted)]">
                              {formatTimelineRange(
                                job.start_date,
                                job.due_date,
                              )}
                            </span>
                          </td>
                          {!isContractorView && (
                            <td className="px-2 py-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                              {formatValue(job.value_pence)}
                            </td>
                          )}
                          <td className="px-2 py-1.5 md:pr-5">
                            <Link
                              href={jobDetailPath.replace('[id]', job.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                              aria-label="Open project"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                    {canEditJobs && (
                      <tr className="border-b border-[color:var(--workspace-shell-border)]">
                        <td
                          colSpan={isContractorView ? 8 : 9}
                          className="px-4 py-2 md:px-5"
                        >
                          <button
                            type="button"
                            onClick={onAddProject}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[#579bfc]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add {projectLabel.toLowerCase()}
                          </button>
                        </td>
                      </tr>
                    )}

                    <tr className="bg-[var(--workspace-shell-sidebar-accent)]">
                      <td className="px-4 py-2 text-xs text-[var(--workspace-shell-text-muted)] md:px-5">
                        Summary
                      </td>
                      <td />
                      <td />
                      <td className="px-2 py-2">
                        <GroupSummaryBar jobs={group.jobs} field="status" />
                      </td>
                      <td className="px-2 py-2">
                        <GroupSummaryBar jobs={group.jobs} field="priority" />
                      </td>
                      <td className="px-2 py-2">
                        <StatusPill style={phaseStyle} />
                      </td>
                      <td className="px-2 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
                        {group.jobs.filter((j) => j.due_date).length} dated
                      </td>
                      {!isContractorView && (
                        <td className="px-2 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
                          {
                            group.jobs.filter((j) => j.value_pence != null)
                              .length
                          }{' '}
                          valued
                        </td>
                      )}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {jobs.length === 0 && (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
          <FileText className="h-10 w-10 text-[var(--workspace-shell-text-muted)]" />
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {uiVariant === 'maintenance'
              ? 'No maintenance jobs yet.'
              : 'No projects yet. Create your first project to get started.'}
          </p>
          {canEditJobs && (
            <button
              type="button"
              onClick={onAddProject}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0073ea] px-4 text-sm font-semibold text-[var(--workspace-shell-text)] hover:bg-[#0060c2]"
            >
              <Plus className="h-4 w-4" />
              {uiVariant === 'maintenance' ? 'New job' : 'New project'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  style,
}: {
  style: { label: string; bg: string; text: string };
}) {
  return (
    <span
      className="inline-flex h-8 w-full items-center justify-center rounded px-2 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function GroupSummaryBar({
  jobs,
  field,
}: {
  jobs: JobsPmRow[];
  field: 'status' | 'priority';
}) {
  const palette = field === 'status' ? JOB_STATUS_CELL : PRIORITY_CELL;

  const counts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job[field];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const total = jobs.length || 1;
  const segments = Object.entries(counts);

  if (segments.length === 0) {
    return (
      <div className="h-2 rounded-full bg-[var(--workspace-control-surface)]" />
    );
  }

  return (
    <div className="flex h-2 overflow-hidden rounded-full">
      {segments.map(([key, count]) => {
        const style = palette[key as keyof typeof palette];
        return (
          <div
            key={key}
            className="h-full"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: style?.bg ?? '#666',
            }}
            title={`${style?.label ?? key}: ${count}`}
          />
        );
      })}
    </div>
  );
}
