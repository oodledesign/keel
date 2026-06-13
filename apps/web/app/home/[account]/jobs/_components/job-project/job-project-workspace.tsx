'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Columns3, GanttChart, List } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import {
  addJobAssignment,
  applyPhaseTemplate,
  createPhase,
  listAccountMembers,
  listJobBoard,
  listPhaseTemplates,
  removeJobAssignment,
} from '../../_lib/server/server-actions';
import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  PhaseTemplateListItem,
} from '../../_lib/schema/project-phases.schema';
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
  isContractorView,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  job: JobSummary;
  client: ClientSummary;
  canEditJobs: boolean;
  isContractorView: boolean;
}) {
  const [view, setView] = useState<ViewMode>('board');
  const [board, setBoard] = useState<JobBoardResult | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [addingPhase, setAddingPhase] = useState(false);
  const [seedingPhases, setSeedingPhases] = useState(false);
  const [members, setMembers] = useState<
    { user_id: string; name: string | null; email: string | null; picture_url?: string | null }[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [phaseTemplates, setPhaseTemplates] = useState<PhaseTemplateListItem[]>([]);
  const [, startTransition] = useTransition();

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    try {
      const data = await listJobBoard({
        accountId,
        accountSlug,
        jobId,
      });
      setBoard(data as JobBoardResult);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBoard(null);
    } finally {
      setBoardLoading(false);
    }
  }, [accountId, accountSlug, jobId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        setMembers(Array.isArray(raw) ? (raw as typeof members) : []);
      })
      .catch(() => setMembers([]));
  }, [accountSlug]);

  useEffect(() => {
    if (!canEditJobs) return;
    void listPhaseTemplates({ accountId })
      .then((rows) => setPhaseTemplates(rows as PhaseTemplateListItem[]))
      .catch(() => setPhaseTemplates([]));
  }, [accountId, canEditJobs]);

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
    [
      accountId,
      accountSlug,
      jobId,
      loadBoard,
      phaseTemplates,
      startTransition,
    ],
  );

  const handleSeedDefaultPhases = useCallback(() => {
    handleApplyTemplate();
  }, [handleApplyTemplate]);

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
        await loadBoard();
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
    selectedMemberId,
    startTransition,
  ]);

  const handleRemoveAssignee = useCallback(
    (userId: string) => {
      startTransition(async () => {
        try {
          await removeJobAssignment({ accountId, jobId, userId });
          await loadBoard();
          toast.success('Assignment removed');
        } catch (err) {
          toast.error(getErrorMessage(err));
        }
      });
    },
    [accountId, jobId, loadBoard, startTransition],
  );

  const viewButtons: { key: ViewMode; label: string; icon: typeof Columns3 }[] = [
    { key: 'board', label: 'Board', icon: Columns3 },
    { key: 'timeline', label: 'Timeline', icon: GanttChart },
    { key: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="space-y-6">
      <JobProjectHeader
        accountSlug={accountSlug}
        jobId={jobId}
        job={job}
        client={client}
        board={
          board
            ? {
                valuePence: board.valuePence,
                costPence: board.costPence,
                progressPct: board.progressPct,
              }
            : {
                valuePence: job.value_pence,
                costPence: job.cost_pence,
                progressPct: 0,
              }
        }
        assignees={board?.assignees ?? []}
        members={members}
        canEditJobs={canEditJobs}
        isContractorView={isContractorView}
        onAddPhase={handleAddPhase}
        addingPhase={addingPhase}
        onOpenAi={() => setAiOpen(true)}
        selectedMemberId={selectedMemberId}
        onSelectedMemberChange={setSelectedMemberId}
        assignRole={assignRole}
        onAssignRoleChange={setAssignRole}
        onAssignMember={handleAssignMember}
        onRemoveAssignee={handleRemoveAssignee}
        assigning={assigning}
      />

      <div className="flex items-center gap-1 border-b border-white/8 px-4 pb-3 md:px-5">
        {viewButtons.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === key
                ? 'bg-[#0073ea]/15 text-[#579bfc]'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {boardLoading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-zinc-800/50" />
          <div className="h-48 animate-pulse rounded-xl bg-zinc-800/40" />
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
        <p className="text-sm text-zinc-500">Could not load project board.</p>
      )}

      {canEditJobs && (
        <ProjectAiGenerateDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          accountId={accountId}
          accountSlug={accountSlug}
          jobId={jobId}
          defaultMode="brief"
          onPlanApplied={() => void loadBoard()}
        />
      )}
    </div>
  );
}
