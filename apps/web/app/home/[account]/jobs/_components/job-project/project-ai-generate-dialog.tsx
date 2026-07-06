'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Plus, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { saveWorkspaceNoteAction } from '~/home/[account]/_lib/workspace-content/notes-actions';

function projectDetailUrl(
  accountSlug: string,
  jobId: string,
  options?: { tab?: string; docId?: string },
) {
  const path = pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId);
  const params = new URLSearchParams();
  if (options?.tab) params.set('tab', options.tab);
  if (options?.docId) params.set('doc', options.docId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

import {
  applyProjectPhasePlan,
  generateProjectContent,
  listProjectAiSources,
} from '../../_lib/server/project-ai-actions';
import { getErrorMessage } from '../../_lib/error-message';
import type {
  ProjectAiSourceListItem,
  ProjectAiSourcesResult,
  ProjectGenerateMode,
  ProjectSourceRef,
} from '../../_lib/schema/project-ai.schema';
import type { PhasePlan } from '~/lib/ai/project-content-generate';

function sourceKey(item: ProjectAiSourceListItem) {
  return `${item.type}:${item.id}`;
}

function SourceGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: ProjectAiSourceListItem[];
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
        {label}
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-2">
        {items.map((item) => {
          const key = sourceKey(item);
          return (
            <li key={key}>
              <label className="flex cursor-pointer gap-2 rounded-md p-1.5 hover:bg-[var(--workspace-control-surface)]/60">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={(v) => onToggle(key, v === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--workspace-shell-text)]">
                    {item.title}
                  </span>
                  <span className="block text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {item.subtitle}
                    {item.preview ? ` · ${item.preview.slice(0, 80)}` : ''}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type PlanReviewState = {
  plan: PhasePlan;
  contextRefs: ProjectSourceRef[];
};

export function ProjectAiGenerateDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  jobId,
  phaseId,
  phaseName,
  defaultMode = 'brief',
  allowedModes,
  onPhasePageGenerated,
  onPlanApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  jobId: string;
  phaseId?: string;
  phaseName?: string;
  defaultMode?: ProjectGenerateMode;
  allowedModes?: ProjectGenerateMode[];
  onPhasePageGenerated?: (content: string) => void;
  onPlanApplied?: () => void;
}) {
  const router = useRouter();
  const modes = allowedModes ?? (
    phaseId
      ? (['brief', 'phase_plan', 'phase_page'] as ProjectGenerateMode[])
      : (['brief', 'phase_plan'] as ProjectGenerateMode[])
  );

  const [loadingSources, setLoadingSources] = useState(false);
  const [sources, setSources] = useState<ProjectAiSourcesResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ProjectGenerateMode>(defaultMode);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [planReview, setPlanReview] = useState<PlanReviewState | null>(null);
  const [rawDraft, setRawDraft] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const allItems = useMemo(() => {
    if (!sources) return [];
    return [
      ...sources.transcripts,
      ...sources.proposals,
      ...sources.notes,
      ...sources.docs,
    ];
  }, [sources]);

  const selectedRefs = useMemo((): ProjectSourceRef[] => {
    return allItems
      .filter((item) => selected.has(sourceKey(item)))
      .map((item) => ({
        type: item.type,
        id: item.id,
        title: item.title,
      }));
  }, [allItems, selected]);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await listProjectAiSources({ accountId, jobId });
      setSources(data as ProjectAiSourcesResult);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setSources(null);
    } finally {
      setLoadingSources(false);
    }
  }, [accountId, jobId]);

  useEffect(() => {
    if (!open) return;
    setPlanReview(null);
    setRawDraft(null);
    setNoteDialogOpen(false);
    setNoteTitle('');
    setNoteContent('');
    setMode(defaultMode);
    setSelected(new Set());
    void loadSources();
  }, [open, defaultMode, loadSources]);

  useEffect(() => {
    if (!modes.includes(mode)) {
      setMode(modes[0] ?? 'brief');
    }
  }, [mode, modes]);

  const toggleSource = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = noteContent.trim();
    if (!content) {
      toast.error('Note content is required');
      return;
    }

    setSavingNote(true);
    try {
      const { noteId } = await saveWorkspaceNoteAction({
        accountId,
        accountSlug,
        title: noteTitle.trim() || undefined,
        content,
        category: 'idea',
        link: { type: 'project', id: jobId },
      });

      toast.success('Project note added');
      setNoteDialogOpen(false);
      setNoteTitle('');
      setNoteContent('');

      const data = await listProjectAiSources({ accountId, jobId });
      setSources(data as ProjectAiSourcesResult);
      setSelected(new Set([`note:${noteId}`]));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedRefs.length === 0) {
      toast.error('Select at least one source');
      return;
    }

    setGenerating(true);
    setRawDraft(null);
    setPlanReview(null);

    try {
      const result = await generateProjectContent({
        accountId,
        accountSlug,
        jobId,
        phaseId,
        mode,
        sourceRefs: selectedRefs,
      });

      const payload = result as
        | { mode: 'brief'; docId: string; title: string }
        | { mode: 'phase_plan'; plan: PhasePlan; contextRefs: ProjectSourceRef[] }
        | { mode: 'phase_plan'; parseError: true; rawDraft: string }
        | { mode: 'phase_page'; content: string };

      if (payload.mode === 'brief') {
        toast.success('Project brief created — opening in Notes and files');
        onOpenChange(false);
        router.push(
          projectDetailUrl(accountSlug, jobId, {
            tab: 'docs',
            docId: payload.docId,
          }),
        );
        router.refresh();
        return;
      }

      if (payload.mode === 'phase_plan') {
        if ('parseError' in payload && payload.parseError) {
          setRawDraft(payload.rawDraft);
          toast.error('Could not parse the plan — paste or edit the draft below');
          return;
        }
        if ('plan' in payload) {
          setPlanReview({
            plan: payload.plan,
            contextRefs: payload.contextRefs ?? selectedRefs,
          });
        }
        return;
      }

      if (payload.mode === 'phase_page') {
        toast.success('Phase page updated');
        onPhasePageGenerated?.(payload.content);
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!planReview) return;
    setApplying(true);
    try {
      await applyProjectPhasePlan({
        accountId,
        accountSlug,
        jobId,
        phases: planReview.plan.phases,
        contextRefs: planReview.contextRefs,
      });
      toast.success('Phases and tasks created');
      onOpenChange(false);
      onPlanApplied?.();
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  const modeLabels: Record<ProjectGenerateMode, string> = {
    brief: 'Project brief',
    phase_plan: 'Phase plan',
    phase_page: phaseName ? `Fill “${phaseName}” page` : 'Fill phase page',
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--ozer-accent)]" />
            Generate with AI
          </DialogTitle>
        </DialogHeader>

        {planReview ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Review the proposed phases and tasks before adding them to the
              project. Nothing is saved until you confirm.
            </p>
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
              {planReview.plan.phases.map((phase, i) => (
                <li
                  key={`${phase.name}-${i}`}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-3"
                >
                  <p className="font-medium text-[var(--workspace-shell-text)]">{phase.name}</p>
                  {phase.description ? (
                    <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      {phase.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {phase.start_date ?? '—'} → {phase.due_date ?? '—'}
                    {phase.is_milestone ? ' · milestone' : ''}
                  </p>
                  {phase.tasks.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-xs text-[var(--workspace-shell-text-muted)]">
                      {phase.tasks.map((t, j) => (
                        <li key={`${t.title}-${j}`}>{t.title}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => setPlanReview(null)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                disabled={applying}
                onClick={handleApplyPlan}
              >
                {applying ? 'Creating…' : 'Confirm & create phases'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">Generation mode</Label>
              <div className="flex flex-col gap-2">
                {modes.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 hover:bg-[var(--workspace-control-surface)]/50"
                  >
                    <input
                      type="radio"
                      name="ai-mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-[var(--ozer-accent)]"
                    />
                    <span className="text-sm">{modeLabels[m]}</span>
                  </label>
                ))}
              </div>
            </div>

            {loadingSources ? (
              <div className="flex items-center gap-2 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sources…
              </div>
            ) : (
              <div className="space-y-4">
                <SourceGroup
                  label="Meeting transcripts"
                  items={sources?.transcripts ?? []}
                  selected={selected}
                  onToggle={toggleSource}
                />
                <SourceGroup
                  label="Proposals"
                  items={sources?.proposals ?? []}
                  selected={selected}
                  onToggle={toggleSource}
                />
                <SourceGroup
                  label="Notes"
                  items={sources?.notes ?? []}
                  selected={selected}
                  onToggle={toggleSource}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
                    onClick={() => setNoteDialogOpen(true)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add project note
                  </Button>
                </div>
                <SourceGroup
                  label="Documents"
                  items={sources?.docs ?? []}
                  selected={selected}
                  onToggle={toggleSource}
                />
                {allItems.length === 0 && (
                  <div className="space-y-3 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-4">
                    <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                      No sources found for this project yet. Add a note with
                      scope, goals, or client context — then select it below to
                      generate a brief or phase plan.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                      onClick={() => setNoteDialogOpen(true)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add project note
                    </Button>
                  </div>
                )}
              </div>
            )}

            {rawDraft && (
              <div className="space-y-2">
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Raw AI output (parse failed)
                </Label>
                <Textarea
                  readOnly
                  value={rawDraft}
                  rows={8}
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs text-[var(--workspace-shell-text-muted)]"
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                disabled={generating || loadingSources || selectedRefs.length === 0}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add project note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNote} className="space-y-3">
            <div>
              <Label htmlFor="ai-note-title" className="text-[var(--workspace-shell-text-muted)]">
                Title (optional)
              </Label>
              <Input
                id="ai-note-title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Discovery call summary"
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div>
              <Label htmlFor="ai-note-content" className="text-[var(--workspace-shell-text-muted)]">
                Note *
              </Label>
              <Textarea
                id="ai-note-content"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={6}
                placeholder="Goals, deliverables, constraints, or anything the AI should use as context…"
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => setNoteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingNote || !noteContent.trim()}
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              >
                {savingNote ? 'Saving…' : 'Save note'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
