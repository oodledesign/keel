'use client';

import { useState } from 'react';

import {
  CalendarRange,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
  Loader2,
  type LucideIcon,
  Sparkles,
  Text,
} from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { isInsufficientAiCreditsMessage } from '~/lib/ai/ai-credits-exhausted';
import type {
  CanvasAiItem,
  CanvasAiRequest,
  CanvasAiResult,
  CanvasAiTaskSuggestion,
} from '~/lib/projects/canvas/canvas-ai';
import type {
  CanvasSectionOutline,
  CanvasSectionPlacement,
} from '~/lib/projects/canvas/canvas-fill';

import { getErrorMessage } from '../../../_lib/error-message';
import { assistProjectCanvas } from '../../../_lib/server/project-canvas-ai.actions';

type Mode = 'summarise' | 'tasks' | 'fill' | 'brainstorm';

type Entry = {
  key: string;
  group: string | null;
  meta: string | null;
  text: string;
  checked: boolean;
  placement?: Omit<CanvasSectionPlacement, 'text'>;
  task?: CanvasAiTaskSuggestion;
};

export type CanvasAiApply =
  | { mode: 'summarise'; title: string; bullets: string[] }
  | { mode: 'brainstorm'; ideas: string[] }
  | { mode: 'section'; sectionId: string; placements: CanvasSectionPlacement[] }
  | {
      mode: 'tasks';
      tasks: CanvasAiTaskSuggestion[];
      phaseId: string | null;
    };

type CanvasAiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  jobId: string;
  selection: CanvasAiItem[];
  sections: CanvasSectionOutline[];
  defaultSectionId: string | null;
  phases: Array<{ id: string; name: string }>;
  onApply: (result: CanvasAiApply) => Promise<void> | void;
};

const MODES: Array<{
  id: Mode;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'summarise',
    label: 'Summarise selection',
    description: 'Themes, decisions and open questions as a sticky',
    icon: Text,
  },
  {
    id: 'tasks',
    label: 'Turn into tasks',
    description: 'Review suggested tasks, then add them to the project',
    icon: ListChecks,
  },
  {
    id: 'fill',
    label: 'Fill a section',
    description: 'Draft notes for a brief, marketing plan or calendar',
    icon: LayoutTemplate,
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    description: 'Ideas on any question, grounded in this project',
    icon: Lightbulb,
  },
];

export function CanvasAiDialog(props: CanvasAiDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            Canvas AI
          </DialogTitle>
          <DialogDescription>
            Uses the project&apos;s phases, tasks, notes and people as context.
            3 AI credits per request.
          </DialogDescription>
        </DialogHeader>
        {props.open ? <AiBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function entriesFor(result: CanvasAiResult, request: CanvasAiRequest): Entry[] {
  switch (result.mode) {
    case 'summarise':
      return result.bullets.map((text, i) => ({
        key: `b${i}`,
        group: null,
        meta: null,
        text,
        checked: true,
      }));
    case 'brainstorm':
      return result.ideas.map((text, i) => ({
        key: `i${i}`,
        group: null,
        meta: null,
        text,
        checked: true,
      }));
    case 'tasks':
      return result.tasks.map((task, i) => ({
        key: `t${i}`,
        group: null,
        meta: [task.priority !== 'medium' ? task.priority : null, task.dueDate]
          .filter(Boolean)
          .join(' · '),
        text: task.title,
        checked: true,
        task,
      }));
    case 'fill_areas': {
      const titles = new Map(
        request.mode === 'fill_areas'
          ? request.areas.map((area) => [area.key, area.title])
          : [],
      );
      return result.areas.flatMap((area) =>
        area.notes.map((text, i) => ({
          key: `${area.key}:${i}`,
          group: titles.get(area.key) ?? null,
          meta: null,
          text,
          checked: true,
          placement: { areaId: area.key },
        })),
      );
    }
    case 'fill_calendar': {
      const rows = new Map(
        request.mode === 'fill_calendar'
          ? request.rows.map((row) => [row.key, row.title])
          : [],
      );
      const weeks =
        request.mode === 'fill_calendar'
          ? request.weeks.map((week) => week.key)
          : [];
      const labels = new Map(
        request.mode === 'fill_calendar'
          ? request.weeks.map((week) => [week.key, week.label])
          : [],
      );
      return [...result.cells]
        .sort(
          (a, b) =>
            [...rows.keys()].indexOf(a.row) - [...rows.keys()].indexOf(b.row) ||
            weeks.indexOf(a.week) - weeks.indexOf(b.week),
        )
        .map((cell) => ({
          key: `${cell.row}:${cell.week}`,
          group: rows.get(cell.row) ?? null,
          meta: labels.get(cell.week) ?? null,
          text: cell.text,
          checked: true,
          placement: { areaId: cell.row, weekId: cell.week },
        }));
    }
  }
}

function AiBody({
  accountId,
  jobId,
  selection,
  sections,
  defaultSectionId,
  phases,
  onApply,
  onOpenChange,
}: CanvasAiDialogProps) {
  const hasSelection = selection.length > 0;
  const [mode, setMode] = useState<Mode>(
    defaultSectionId ? 'fill' : hasSelection ? 'summarise' : 'brainstorm',
  );
  const [sectionId, setSectionId] = useState(
    defaultSectionId ?? sections[0]?.id ?? '',
  );
  const [focus, setFocus] = useState('');
  const [prompt, setPrompt] = useState('');
  const [phaseId, setPhaseId] = useState<string>('none');
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    data: CanvasAiResult;
    entries: Entry[];
    sectionId: string | null;
  } | null>(null);

  const section = sections.find((s) => s.id === sectionId) ?? null;

  const buildRequest = (): CanvasAiRequest | null => {
    switch (mode) {
      case 'summarise':
        return hasSelection ? { mode: 'summarise', items: selection } : null;
      case 'tasks':
        return hasSelection ? { mode: 'tasks', items: selection } : null;
      case 'brainstorm':
        return prompt.trim().length >= 3
          ? {
              mode: 'brainstorm',
              prompt: prompt.trim(),
              items: selection.slice(0, 40),
            }
          : null;
      case 'fill': {
        if (!section) return null;
        const instructions = focus.trim() || undefined;
        const toArea = (area: {
          id: string;
          title: string;
          existing: string[];
        }) => ({
          key: area.id,
          title: area.title.slice(0, 200),
          existing: area.existing.map((text) => text.slice(0, 1000)),
        });
        const sectionTitle = section.title.slice(0, 200);
        if (section.layout === 'calendar') {
          return {
            mode: 'fill_calendar',
            sectionTitle,
            instructions,
            rows: section.rows.slice(0, 10).map(toArea),
            weeks: section.weeks.slice(0, 8).map((week) => ({
              key: week.id,
              label: week.label.slice(0, 60),
            })),
          };
        }
        return {
          mode: 'fill_areas',
          sectionTitle,
          instructions,
          areas: section.areas.slice(0, 12).map(toArea),
        };
      }
    }
  };

  const request = buildRequest();

  const run = async () => {
    if (!request) return;
    setRunning(true);
    setError(null);
    try {
      const data = await assistProjectCanvas({ accountId, jobId, request });
      const entries = entriesFor(data, request);
      if (entries.length === 0) {
        setError('The AI had nothing useful to add — try adding more detail.');
        return;
      }
      setResult({
        data,
        entries,
        sectionId: mode === 'fill' ? sectionId : null,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(
        isInsufficientAiCreditsMessage(message)
          ? 'Not enough AI credits for this request. Top up credits and try again.'
          : message,
      );
    } finally {
      setRunning(false);
    }
  };

  const updateEntry = (key: string, patch: Partial<Entry>) =>
    setResult((prev) =>
      prev
        ? {
            ...prev,
            entries: prev.entries.map((entry) =>
              entry.key === key ? { ...entry, ...patch } : entry,
            ),
          }
        : prev,
    );

  const apply = async () => {
    if (!result) return;
    const chosen = result.entries.filter(
      (entry) => entry.checked && entry.text.trim(),
    );
    if (chosen.length === 0) return;
    setApplying(true);
    try {
      const data = result.data;
      if (data.mode === 'summarise') {
        await onApply({
          mode: 'summarise',
          title: data.title,
          bullets: chosen.map((entry) => entry.text.trim()),
        });
      } else if (data.mode === 'brainstorm') {
        await onApply({
          mode: 'brainstorm',
          ideas: chosen.map((entry) => entry.text.trim()),
        });
      } else if (data.mode === 'tasks') {
        await onApply({
          mode: 'tasks',
          phaseId: phaseId === 'none' ? null : phaseId,
          tasks: chosen.map((entry) => ({
            ...entry.task!,
            title: entry.text.trim(),
          })),
        });
      } else if (result.sectionId) {
        await onApply({
          mode: 'section',
          sectionId: result.sectionId,
          placements: chosen.map((entry) => ({
            ...entry.placement!,
            text: entry.text.trim(),
          })),
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  if (result) {
    const checkedCount = result.entries.filter((e) => e.checked).length;
    const applyLabel =
      result.data.mode === 'tasks'
        ? `Create ${checkedCount} task${checkedCount === 1 ? '' : 's'}`
        : result.data.mode === 'summarise'
          ? 'Add summary sticky'
          : result.data.mode === 'brainstorm'
            ? `Add ${checkedCount} ${checkedCount === 1 ? 'sticky' : 'stickies'}`
            : `Add ${checkedCount} to section`;
    return (
      <div className="space-y-3">
        {result.data.mode === 'summarise' ? (
          <p className="text-sm font-semibold">{result.data.title}</p>
        ) : null}
        <div className="space-y-1.5">
          {result.entries.map((entry, index) => {
            const header =
              entry.group && entry.group !== result.entries[index - 1]?.group
                ? entry.group
                : null;
            return (
              <div key={entry.key}>
                {header ? (
                  <p className="mt-2 mb-1 text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                    {header}
                  </p>
                ) : null}
                <div className="flex items-start gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-2.5 py-2">
                  <Checkbox
                    checked={entry.checked}
                    onCheckedChange={(checked) =>
                      updateEntry(entry.key, { checked: checked === true })
                    }
                    className="mt-1"
                    aria-label="Include"
                  />
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={entry.text}
                      rows={1}
                      maxLength={500}
                      onChange={(event) =>
                        updateEntry(entry.key, { text: event.target.value })
                      }
                      className={cn(
                        'field-sizing-content w-full resize-none bg-transparent text-sm outline-none',
                        !entry.checked &&
                          'text-[var(--workspace-shell-text-muted)] line-through',
                      )}
                    />
                    {entry.meta ? (
                      <p className="text-[11px] text-[var(--workspace-shell-text-muted)] capitalize">
                        {entry.meta}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {result.data.mode === 'tasks' ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--workspace-shell-text-muted)]">
              Add to phase
            </span>
            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No phase</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={applying}
            onClick={() => {
              setResult(null);
              setError(null);
            }}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={applying || checkedCount === 0}
            onClick={() => void apply()}
          >
            {applying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {applyLabel}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((option) => {
          const disabled =
            ((option.id === 'summarise' || option.id === 'tasks') &&
              !hasSelection) ||
            (option.id === 'fill' && sections.length === 0);
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setMode(option.id);
                setError(null);
              }}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                mode === option.id
                  ? 'border-[var(--ozer-accent)] bg-[var(--workspace-shell-sidebar-accent)]'
                  : 'border-[color:var(--workspace-shell-border)] hover:border-[var(--ozer-accent)]/60',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-[var(--ozer-accent)]" />
                {option.label}
              </span>
              <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                {disabled
                  ? option.id === 'fill'
                    ? 'Add a template from the Templates menu first'
                    : 'Select some cards first'
                  : option.description}
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'summarise' || mode === 'tasks' ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Using {selection.length} selected item
          {selection.length === 1 ? '' : 's'}.
        </p>
      ) : null}

      {mode === 'fill' ? (
        <div className="space-y-2">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choose a section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <span className="flex items-center gap-2">
                    {option.layout === 'calendar' ? (
                      <CalendarRange className="h-3.5 w-3.5" />
                    ) : (
                      <LayoutTemplate className="h-3.5 w-3.5" />
                    )}
                    {option.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={focus}
            maxLength={500}
            rows={2}
            placeholder="Anything to focus on? (optional) e.g. launch in March, target first-time buyers"
            onChange={(event) => setFocus(event.target.value)}
          />
        </div>
      ) : null}

      {mode === 'brainstorm' ? (
        <Textarea
          value={prompt}
          maxLength={500}
          rows={3}
          autoFocus
          placeholder="What should we brainstorm? e.g. launch event ideas, ways to reduce snagging, social post angles"
          onChange={(event) => setPrompt(event.target.value)}
        />
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <DialogFooter>
        <Button
          type="button"
          disabled={!request || running}
          onClick={() => void run()}
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {running ? 'Thinking…' : 'Generate'}
        </Button>
      </DialogFooter>
    </div>
  );
}
