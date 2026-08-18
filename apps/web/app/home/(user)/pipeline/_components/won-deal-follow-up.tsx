'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ClipboardList, ListTodo, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { loadTaskAssignmentOptionsForWorkspace } from '~/home/(user)/_lib/actions/task-actions';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { CreateProjectDialog } from '~/home/[account]/projects/_components/create-project-dialog';
import type { ExtractedTaskReviewRow } from '~/home/[account]/tasks/_lib/server/task-ai-actions';
import {
  commitWorkspaceExtractedTasks,
  extractWorkspaceTasksFromTranscript,
} from '~/home/[account]/tasks/_lib/server/task-ai-actions';
import { MAX_EXTRACT_INSTRUCTIONS_LENGTH } from '~/lib/ai/extract-instructions';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

const NONE_PROJECT = '__none__';

function dealTitle(deal: PipelineDeal) {
  return (
    deal.projectName?.trim() ||
    deal.companyName?.trim() ||
    deal.contactName?.trim() ||
    'Won lead'
  );
}

function buildDealSourceText(deal: PipelineDeal, extra: string) {
  const lines = [
    'Won pipeline lead. Create practical kickoff and delivery tasks from this opportunity.',
    `Title: ${dealTitle(deal)}`,
    deal.companyName ? `Company: ${deal.companyName}` : null,
    deal.contactName ? `Contact: ${deal.contactName}` : null,
    deal.clientName ? `Client: ${deal.clientName}` : null,
    deal.value > 0 ? `Value: £${deal.value.toLocaleString('en-GB')}` : null,
    deal.nextAction ? `Next action: ${deal.nextAction}` : null,
    deal.description?.trim() ? `Brief:\n${deal.description.trim()}` : null,
    extra.trim()
      ? `Additional details from the user:\n${extra.trim().slice(0, 2000)}`
      : null,
  ].filter(Boolean);

  return lines.join('\n\n');
}

type Step = 'choose' | 'project' | 'tasks';

type WonDealFollowUpProps = {
  deal: PipelineDeal | null;
  accountId: string;
  accountSlug: string;
  onClose: () => void;
  onCompleted: () => void;
};

export function WonDealFollowUp({
  deal,
  accountId,
  accountSlug,
  onClose,
  onCompleted,
}: WonDealFollowUpProps) {
  const [step, setStep] = useState<Step>('choose');

  useEffect(() => {
    if (deal) {
      setStep('choose');
    }
  }, [deal?.id]);

  if (!deal) return null;

  const title = dealTitle(deal);

  return (
    <>
      <Dialog
        open={step === 'choose'}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>This lead is won</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Turn “{title}” into a delivery project, or generate tasks from
              what you already know.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-test="won-deal-create-project"
              onClick={() => setStep('project')}
              className={cn(
                'flex flex-col items-start rounded-xl border p-4 text-left transition-colors',
                'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[var(--ozer-accent)]/50',
              )}
            >
              <ClipboardList className="mb-2 h-5 w-5 text-[var(--ozer-accent)]" />
              <span className="text-sm font-semibold">Create a project</span>
              <span className="mt-1 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                Add dates, value, and other delivery fields before you start.
              </span>
            </button>
            <button
              type="button"
              data-test="won-deal-create-tasks"
              onClick={() => setStep('tasks')}
              className={cn(
                'flex flex-col items-start rounded-xl border p-4 text-left transition-colors',
                'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[var(--ozer-accent)]/50',
              )}
            >
              <ListTodo className="mb-2 h-5 w-5 text-[var(--ozer-accent)]" />
              <span className="text-sm font-semibold">Create tasks</span>
              <span className="mt-1 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                Let AI draft tasks, with a prompt to add more detail or attach
                them to an existing project.
              </span>
            </button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
              onClick={onClose}
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateProjectDialog
        key={`${deal.id}-project`}
        open={step === 'project'}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        accountId={accountId}
        accountSlug={accountSlug}
        hideTypePicker
        dialogTitle="Finish the project"
        dialogDescription="Add any extra fields for this won lead, then create the delivery project."
        defaults={{
          name: title,
          clientId: deal.clientId ?? '',
          description: deal.description?.trim() || '',
          valueGbp: deal.value > 0 ? String(deal.value) : '',
        }}
        projectDetailPathBuilder={(id) =>
          `${pathsConfig.app.accountProjects.replace('[account]', accountSlug)}/${id}`
        }
        onSuccess={onCompleted}
      />

      <WonDealTasksDialog
        open={step === 'tasks'}
        deal={deal}
        accountId={accountId}
        accountSlug={accountSlug}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    </>
  );
}

function WonDealTasksDialog({
  open,
  deal,
  accountId,
  accountSlug,
  onClose,
  onCompleted,
}: {
  open: boolean;
  deal: PipelineDeal;
  accountId: string;
  accountSlug: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [extra, setExtra] = useState('');
  const [projectId, setProjectId] = useState(NONE_PROJECT);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [rows, setRows] = useState<ExtractedTaskReviewRow[] | null>(null);
  const [busy, setBusy] = useState<'extract' | 'commit' | null>(null);

  useEffect(() => {
    if (!open) {
      setExtra('');
      setProjectId(NONE_PROJECT);
      setRows(null);
      setBusy(null);
      return;
    }

    void loadTaskAssignmentOptionsForWorkspace(accountId)
      .then((options) =>
        setProjects(
          options
            .filter((option) => option.type === 'project')
            .map((option) => ({ id: option.id, name: option.name })),
        ),
      )
      .catch(() => setProjects([]));
  }, [open, accountId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
  );

  const generate = () => {
    setBusy('extract');
    startTransition(async () => {
      try {
        const instructions = [
          'This is a won sales lead, not a meeting transcript. Draft kickoff and delivery tasks.',
          selectedProject
            ? `Assign every task to the existing project "${selectedProject.name}".`
            : 'Leave project suggestions empty unless the brief clearly names an existing project.',
          extra.trim() || null,
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, MAX_EXTRACT_INSTRUCTIONS_LENGTH);

        const result = await extractWorkspaceTasksFromTranscript({
          accountId,
          rawText: buildDealSourceText(deal, extra),
          preferredClientId: deal.clientId ?? undefined,
          instructions,
        });

        const nextRows = result.rows.map((row) => ({
          ...row,
          projectId: selectedProject?.id ?? row.projectId,
          clientId: deal.clientId ?? row.clientId,
          included: true,
        }));
        setRows(nextRows);

        if (nextRows.length === 0) {
          toast.message('No tasks generated', {
            description: 'Add a bit more detail and try again.',
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not generate tasks',
        );
      } finally {
        setBusy(null);
      }
    });
  };

  const commit = () => {
    if (!rows?.length) return;
    const included = rows.filter((row) => row.included);
    if (included.length === 0) {
      toast.error('Select at least one task to create');
      return;
    }

    setBusy('commit');
    startTransition(async () => {
      try {
        const result = await commitWorkspaceExtractedTasks({
          accountId,
          accountSlug,
          items: included.map((row) => ({
            id: row.id,
            title: row.title,
            notes: row.notes,
            dueDate: row.dueDate,
            priority: row.priority,
            projectId: selectedProject?.id ?? row.projectId,
            clientId: deal.clientId ?? row.clientId,
            included: true,
            personAssignee: row.personAssignee,
            subtasks: row.subtasks.map((subtask) => ({
              id: subtask.id,
              title: subtask.title,
              notes: subtask.notes,
              dueDate: subtask.dueDate,
              priority: subtask.priority,
              included: subtask.included,
            })),
          })),
        });
        toast.success(`Created ${result.created} task(s)`);
        onCompleted();
        router.push(
          pathsConfig.app.accountTasks.replace('[account]', accountSlug),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create tasks',
        );
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create tasks from this lead</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            AI will use the won lead details. Add extra notes, or attach the
            tasks to an existing project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Add to existing project
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                <SelectValue placeholder="Standalone tasks" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem
                  value={NONE_PROJECT}
                  className={workspaceSelectItemClass}
                >
                  Standalone tasks (no project)
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem
                    key={project.id}
                    value={project.id}
                    className={workspaceSelectItemClass}
                  >
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label
              htmlFor="won-deal-extra"
              className="text-[var(--workspace-shell-text-muted)]"
            >
              Extra details for AI
            </Label>
            <Textarea
              id="won-deal-extra"
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              rows={4}
              className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              placeholder="Kickoff call Thursday, send contract, set up brand folder…"
            />
          </div>

          {rows && rows.length > 0 ? (
            <ul className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start gap-2">
                  <Checkbox
                    checked={row.included}
                    onCheckedChange={(checked) =>
                      setRows((current) =>
                        (current ?? []).map((item) =>
                          item.id === row.id
                            ? { ...item, included: checked === true }
                            : item,
                        ),
                      )
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {row.title}
                    </p>
                    {row.notes ? (
                      <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                        {row.notes}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
              disabled={pending}
              data-test="won-deal-generate-tasks"
              onClick={generate}
            >
              {busy === 'extract' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {rows?.length ? 'Regenerate' : 'Generate tasks'}
            </Button>
            {rows && rows.length > 0 ? (
              <Button
                type="button"
                className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[var(--ozer-accent-hover)]"
                disabled={pending}
                data-test="won-deal-commit-tasks"
                onClick={commit}
              >
                {busy === 'commit' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create selected
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
