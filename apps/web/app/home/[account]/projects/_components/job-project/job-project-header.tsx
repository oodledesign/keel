'use client';

import Link from 'next/link';

import { Plus, Sparkles, UserPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
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

import { AskBrainLink } from '../../../brain/_components/ask-brain-link';

import type {
  JobBoardAssignee,
  JobBoardResult,
} from '../../_lib/schema/project-phases.schema';
import {
  formatShortDate,
  formatValuePence,
} from './job-project.constants';

type JobSummary = {
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
};

type ClientSummary = {
  id: string;
  display_name: string | null;
} | null;

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function JobProjectHeader({
  accountSlug,
  jobId,
  job,
  client,
  board,
  assignees,
  members,
  canEditJobs,
  isContractorView,
  onAddPhase,
  addingPhase,
  onOpenAi,
  selectedMemberId,
  onSelectedMemberChange,
  assignRole,
  onAssignRoleChange,
  onAssignMember,
  onRemoveAssignee,
  assigning,
}: {
  accountSlug: string;
  jobId: string;
  job: JobSummary;
  client: ClientSummary;
  board: Pick<
    JobBoardResult,
    'valuePence' | 'costPence' | 'progressPct'
  > | null;
  assignees: JobBoardAssignee[];
  members: { user_id: string; name: string | null; email: string | null; picture_url?: string | null }[];
  canEditJobs: boolean;
  isContractorView: boolean;
  onAddPhase: () => void;
  addingPhase: boolean;
  onOpenAi?: () => void;
  selectedMemberId: string;
  onSelectedMemberChange: (id: string) => void;
  assignRole: string;
  onAssignRoleChange: (role: string) => void;
  onAssignMember: () => void;
  onRemoveAssignee: (userId: string) => void;
  assigning: boolean;
}) {
  const clientsPath = pathsConfig.app.accountClients.replace('[account]', accountSlug);
  const progressPct = board?.progressPct ?? 0;
  const assignedIds = new Set(assignees.map((a) => a.user_id));
  const membersNotAssigned = members.filter((m) => !assignedIds.has(m.user_id));

  return (
    <div className="space-y-5 border-b border-[color:var(--workspace-shell-border)] pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                job.status === 'completed'
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]'
                  : job.status === 'cancelled'
                    ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text-muted)]'
                    : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {JOB_STATUS_LABELS[job.status] ?? job.status}
            </span>
            <span className="rounded-full bg-[var(--workspace-shell-panel-hover)] px-2.5 py-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
              {PRIORITY_LABELS[job.priority] ?? job.priority}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
            {client && (
              <span>
                Client{' '}
                <Link
                  href={`${clientsPath}/${client.id}`}
                  className="text-[var(--workspace-shell-text)] underline hover:text-[var(--workspace-shell-text)]"
                >
                  {client.display_name ?? 'Client'}
                </Link>
              </span>
            )}
            <span>Start {formatShortDate(job.start_date)}</span>
            <span>Due {formatShortDate(job.due_date)}</span>
            {!isContractorView && (
              <>
                <span>Value {formatValuePence(board?.valuePence)}</span>
                <span>Cost {formatValuePence(board?.costPence)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AskBrainLink
            accountSlug={accountSlug}
            label="Ask AI"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            params={{
              jobId,
              jobTitle: job.title,
              clientId: client?.id,
              clientName: client?.display_name ?? undefined,
              q: `What should I know about the project "${job.title}"?`,
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            disabled={!canEditJobs}
            onClick={() => {
              if (canEditJobs && onOpenAi) onOpenAi();
              else toast.message('You need jobs edit permission to generate content');
            }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Generate with AI
          </Button>
          {canEditJobs && (
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              disabled={addingPhase}
              onClick={onAddPhase}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {addingPhase ? 'Adding…' : 'Add phase'}
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--workspace-shell-text-muted)]">
          <span>Progress</span>
          <span className="tabular-nums text-[var(--workspace-shell-text-muted)]">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
          <div
            className="h-full rounded-full bg-[var(--ozer-accent)] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {assignees.length === 0 ? (
            <span className="text-sm text-[var(--workspace-shell-text-muted)]">No team assigned</span>
          ) : (
            assignees.map((a) => (
              <div
                key={a.user_id}
                className="group flex items-center gap-1.5 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/60 py-0.5 pl-0.5 pr-2"
                title={a.name ?? a.email ?? a.user_id}
              >
                <ProfileAvatar
                  displayName={a.name ?? a.email ?? '?'}
                  pictureUrl={a.picture_url}
                  className="h-7 w-7"
                />
                <span className="max-w-[120px] truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {a.name ?? a.email ?? a.user_id.slice(0, 8)}
                </span>
                {canEditJobs && (
                  <button
                    type="button"
                    className="ml-0.5 hidden text-[var(--workspace-shell-text-muted)] hover:text-red-400 group-hover:inline"
                    onClick={() => onRemoveAssignee(a.user_id)}
                    aria-label="Remove assignee"
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {canEditJobs && members.length > 0 && membersNotAssigned.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px]">
              <Label className="flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)]">
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Label>
              <Select
                value={selectedMemberId || 'none'}
                onValueChange={(v) =>
                  onSelectedMemberChange(v === 'none' ? '' : v)
                }
              >
                <SelectTrigger className="mt-1 h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {membersNotAssigned.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name || m.email || m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Role"
              value={assignRole}
              onChange={(e) => onAssignRoleChange(e.target.value)}
              className="h-8 w-24 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]"
              disabled={!selectedMemberId || assigning}
              onClick={onAssignMember}
            >
              {assigning ? '…' : 'Add'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
