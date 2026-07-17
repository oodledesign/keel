'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  Columns3,
  GanttChart,
  List,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  UserPlus,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { buildBrainChatUrl } from '~/lib/brain/build-brain-chat-url';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  PhaseTemplateListItem,
} from '../../_lib/schema/project-phases.schema';
import {
  addJobAssignment,
  applyPhaseTemplate,
  createPhase,
  listJobBoard,
  listPhaseTemplates,
} from '../../_lib/server/server-actions';
import { JobProjectBoard } from './job-project-board';
import { JobProjectHeader } from './job-project-header';
import { JobProjectList } from './job-project-list';
import { JobProjectTimeline } from './job-project-timeline';
import { ProjectAiGenerateDialog } from './project-ai-generate-dialog';

type ViewMode = 'board' | 'timeline' | 'list';

type JobSummary = {
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  value_pence: number | null;
  cost_pence: number | null;
};

type ClientSummary = {
  id: string;
  display_name: string | null;
} | null;

export function JobProjectWorkspace({
  accountSlug,
  accountId,
  jobId,
  job,
  client,
  canEditJobs,
  isContractorView: _isContractorView,
  onAssignmentsChange,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  job: JobSummary;
  client: ClientSummary;
  canEditJobs: boolean;
  isContractorView: boolean;
  onAssignmentsChange?: () => void;
}) {
  const [view, setView] = useState<ViewMode>('board');
  const [board, setBoard] = useState<JobBoardResult | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [addingPhase, setAddingPhase] = useState(false);
  const [seedingPhases, setSeedingPhases] = useState(false);
  const [members, setMembers] = useState<
    {
      user_id: string;
      name: string | null;
      email: string | null;
      picture_url?: string | null;
    }[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [phaseTemplates, setPhaseTemplates] = useState<PhaseTemplateListItem[]>(
    [],
  );
  const [, startTransition] = useTransition();

  const askAiHref = buildBrainChatUrl(accountSlug, {
    jobId,
    jobTitle: job.title,
    clientId: client?.id,
    clientName: client?.display_name ?? undefined,
    q: `What should I know about the project "${job.title}"?`,
  });

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    try {
      const data = await listJobBoard({
        accountId,
        accountSlug,
        jobId,
      });
      const nextBoard = data as JobBoardResult;
      setBoard(nextBoard);
      setMembers(nextBoard.members ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBoard(null);
      setMembers([]);
    } finally {
      setBoardLoading(false);
    }
  }, [accountId, accountSlug, jobId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!canEditJobs || boardLoading || !board || board.phases.length > 0) {
      return;
    }

    void listPhaseTemplates({ accountId })
      .then((rows) => setPhaseTemplates(rows as PhaseTemplateListItem[]))
      .catch(() => setPhaseTemplates([]));
  }, [accountId, board, boardLoading, canEditJobs]);

  const handleAddPhase = useCallback(() => {
    setAddingPhase(true);
    startTransition(async () => {
      try {
        await createPhase({
          accountId,
          accountSlug,
          jobId,
          name: 'New phase',
          status: 'not_started',
          is_milestone: false,
        });
        await loadBoard();
        toast.success('Phase added');
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setAddingPhase(false);
      }
    });
  }, [accountId, accountSlug, jobId, loadBoard, startTransition]);

  const handleApplyTemplate = useCallback(
    (templateId?: string) => {
      const template =
        phaseTemplates.find((item) => item.id === templateId) ??
        phaseTemplates[0];
      if (!template) {
        toast.error('No phase templates available');
        return;
      }

      setSeedingPhases(true);
      startTransition(async () => {
        try {
          await applyPhaseTemplate({
            accountId,
            accountSlug,
            jobId,
            templateId: template.id,
          });
          await loadBoard();
          toast.success(`Applied “${template.name}” template`);
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setSeedingPhases(false);
        }
      });
    },
    [accountId, accountSlug, jobId, loadBoard, phaseTemplates, startTransition],
  );

  const handleSeedDefaultPhases = useCallback(() => {
    handleApplyTemplate();
  }, [handleApplyTemplate]);

  const assignedIds = new Set((board?.assignees ?? []).map((a) => a.user_id));
  const membersNotAssigned = members.filter((m) => !assignedIds.has(m.user_id));

  const handleAssignMember = useCallback(() => {
    if (!selectedMemberId) return;
    setAssigning(true);
    startTransition(async () => {
      try {
        await addJobAssignment({
          accountId,
          jobId,
          userId: selectedMemberId,
          role_on_job: assignRole.trim() || undefined,
        });
        setSelectedMemberId('');
        setAssignRole('');
        setAssignDialogOpen(false);
        await loadBoard();
        onAssignmentsChange?.();
        toast.success('Team member assigned');
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setAssigning(false);
      }
    });
  }, [
    accountId,
    assignRole,
    jobId,
    loadBoard,
    onAssignmentsChange,
    selectedMemberId,
    startTransition,
  ]);

  const viewButtons: { key: ViewMode; label: string; icon: typeof Columns3 }[] =
    [
      { key: 'board', label: 'Board', icon: Columns3 },
      { key: 'timeline', label: 'Timeline', icon: GanttChart },
      { key: 'list', label: 'List', icon: List },
    ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <JobProjectHeader
        board={board ? { progressPct: board.progressPct } : { progressPct: 0 }}
      />

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3">
        <div className="flex items-center gap-1">
          {viewButtons.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === key
                  ? 'bg-[#0073ea]/15 text-[#579bfc]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                aria-label="Project actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]"
            >
              <DropdownMenuItem
                asChild
                className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
              >
                <Link href={askAiHref}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Ask AI
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                disabled={!canEditJobs}
                onClick={() => {
                  if (canEditJobs) setAiOpen(true);
                  else
                    toast.message(
                      'You need jobs edit permission to generate content',
                    );
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </DropdownMenuItem>
              {canEditJobs && members.length > 0 ? (
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                  disabled={membersNotAssigned.length === 0}
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign team member
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {canEditJobs ? (
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              disabled={addingPhase}
              onClick={handleAddPhase}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {addingPhase ? 'Adding…' : 'Add phase'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {boardLoading ? (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-xl bg-[var(--workspace-control-surface)]/50" />
            <div className="h-48 animate-pulse rounded-xl bg-[var(--workspace-control-surface)]/40" />
          </div>
        ) : board ? (
          <>
            {view === 'board' && (
              <JobProjectBoard
                accountSlug={accountSlug}
                accountId={accountId}
                jobId={jobId}
                board={board}
                canEditJobs={canEditJobs}
                members={members}
                onBoardChange={setBoard}
                onSeedDefaultPhases={handleSeedDefaultPhases}
                onApplyTemplate={handleApplyTemplate}
                phaseTemplates={phaseTemplates}
                seedingPhases={seedingPhases}
              />
            )}
            {view === 'timeline' && (
              <JobProjectTimeline
                accountSlug={accountSlug}
                accountId={accountId}
                jobId={jobId}
                board={board}
                canEditJobs={canEditJobs}
                onBoardChange={setBoard}
              />
            )}
            {view === 'list' && (
              <JobProjectList
                accountSlug={accountSlug}
                accountId={accountId}
                jobId={jobId}
                board={board}
                canEditJobs={canEditJobs}
                onBoardChange={setBoard}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Could not load project board.
          </p>
        )}
      </div>

      {canEditJobs ? (
        <>
          <ProjectAiGenerateDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={jobId}
            defaultMode="brief"
            onPlanApplied={() => void loadBoard()}
          />

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign team member</DialogTitle>
              </DialogHeader>
              {membersNotAssigned.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  All members are already assigned to this project.
                </p>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Member
                    </Label>
                    <Select
                      value={selectedMemberId || 'none'}
                      onValueChange={(v) =>
                        setSelectedMemberId(v === 'none' ? '' : v)
                      }
                    >
                      <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                        <SelectValue placeholder="Select member" />
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
                  <div>
                    <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Role (optional)
                    </Label>
                    <Input
                      placeholder="e.g. Designer"
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value)}
                      className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                    disabled={!selectedMemberId || assigning}
                    onClick={handleAssignMember}
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
