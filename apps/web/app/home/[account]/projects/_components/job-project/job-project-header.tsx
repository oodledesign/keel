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
    <div className="space-y-5 border-b border-zinc-700 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                job.status === 'completed'
                  ? 'bg-[var(--keel-teal)]/20 text-[#5eead4]'
                  : job.status === 'cancelled'
                    ? 'bg-zinc-600 text-zinc-400'
                    : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {JOB_STATUS_LABELS[job.status] ?? job.status}
            </span>
            <span className="rounded-full bg-zinc-600 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
              {PRIORITY_LABELS[job.priority] ?? job.priority}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            {client && (
              <span>
                Client{' '}
                <Link
                  href={`${clientsPath}/${client.id}`}
                  className="text-zinc-200 underline hover:text-white"
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
            className="border-zinc-600 text-zinc-300"
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
            className="border-zinc-600 text-zinc-300"
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
              className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
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
        <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
          <span>Progress</span>
          <span className="tabular-nums text-zinc-300">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-[var(--keel-teal)] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {assignees.length === 0 ? (
            <span className="text-sm text-zinc-500">No team assigned</span>
          ) : (
            assignees.map((a) => (
              <div
                key={a.user_id}
                className="group flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/60 py-0.5 pl-0.5 pr-2"
                title={a.name ?? a.email ?? a.user_id}
              >
                <ProfileAvatar
                  displayName={a.name ?? a.email ?? '?'}
                  pictureUrl={a.picture_url}
                  className="h-7 w-7"
                />
                <span className="max-w-[120px] truncate text-xs text-zinc-300">
                  {a.name ?? a.email ?? a.user_id.slice(0, 8)}
                </span>
                {canEditJobs && (
                  <button
                    type="button"
                    className="ml-0.5 hidden text-zinc-500 hover:text-red-400 group-hover:inline"
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
              <Label className="flex items-center gap-1 text-xs text-zinc-500">
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Label>
              <Select
                value={selectedMemberId || 'none'}
                onValueChange={(v) =>
                  onSelectedMemberChange(v === 'none' ? '' : v)
                }
              >
                <SelectTrigger className="mt-1 h-8 border-zinc-600 bg-zinc-800 text-white">
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
              className="h-8 w-24 border-zinc-600 bg-zinc-800 text-white"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
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
