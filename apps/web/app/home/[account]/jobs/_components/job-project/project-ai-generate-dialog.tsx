'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

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
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900/40 p-2">
        {items.map((item) => {
          const key = sourceKey(item);
          return (
            <li key={key}>
              <label className="flex cursor-pointer gap-2 rounded-md p-1.5 hover:bg-zinc-800/60">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={(v) => onToggle(key, v === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {item.title}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
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
        toast.success('Project brief created');
        onOpenChange(false);
        router.push(
          pathsConfig.app.accountDocDetail
            .replace('[account]', accountSlug)
            .replace('[docId]', payload.docId),
        );
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-700 bg-[var(--workspace-shell-panel)] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--keel-teal)]" />
            Generate with AI
          </DialogTitle>
        </DialogHeader>

        {planReview ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Review the proposed phases and tasks before adding them to the
              project. Nothing is saved until you confirm.
            </p>
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
              {planReview.plan.phases.map((phase, i) => (
                <li
                  key={`${phase.name}-${i}`}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                >
                  <p className="font-medium text-white">{phase.name}</p>
                  {phase.description ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      {phase.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {phase.start_date ?? '—'} → {phase.due_date ?? '—'}
                    {phase.is_milestone ? ' · milestone' : ''}
                  </p>
                  {phase.tasks.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-xs text-zinc-300">
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
                className="border-zinc-600"
                onClick={() => setPlanReview(null)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
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
              <Label className="text-xs text-zinc-500">Generation mode</Label>
              <div className="flex flex-col gap-2">
                {modes.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 hover:bg-zinc-800/50"
                  >
                    <input
                      type="radio"
                      name="ai-mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-[var(--keel-teal)]"
                    />
                    <span className="text-sm">{modeLabels[m]}</span>
                  </label>
                ))}
              </div>
            </div>

            {loadingSources ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
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
                <SourceGroup
                  label="Documents"
                  items={sources?.docs ?? []}
                  selected={selected}
                  onToggle={toggleSource}
                />
                {allItems.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    No sources found for this job yet. Add notes, docs,
                    transcripts, or proposals linked to the client or job.
                  </p>
                )}
              </div>
            )}

            {rawDraft && (
              <div className="space-y-2">
                <Label className="text-xs text-zinc-500">
                  Raw AI output (parse failed)
                </Label>
                <Textarea
                  readOnly
                  value={rawDraft}
                  rows={8}
                  className="border-zinc-600 bg-zinc-900 text-xs text-zinc-300"
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
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
  );
}
