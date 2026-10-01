'use client';

import { useState } from 'react';

import { Plus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  logMetricPoint,
  metricProgress,
  parseIsoDate,
  parseMetricNumber,
  toIsoDate,
  totalizerSize,
} from '~/lib/projects/canvas/canvas-metric';
import {
  CANVAS_COLORS,
  CANVAS_COLOR_KEYS,
  type CanvasColorKey,
  type CanvasItem,
  type CanvasItemData,
  type CanvasMetricSource,
  type CanvasMilestone,
} from '~/lib/projects/canvas/canvas-types';

/** Edit a figure card: what it measures, where it is now and where it's going. */
type DialogProps = {
  item: CanvasItem | null;
  onSave: (
    id: string,
    patch: Partial<CanvasItemData>,
    size?: { w: number; h: number },
  ) => void;
  onClose: () => void;
};

export function CanvasMetricDialog({ item, onSave, onClose }: DialogProps) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        {item ? (
          <MetricForm
            key={item.id}
            item={item}
            onSave={onSave}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const SOURCES: Array<{ key: CanvasMetricSource; label: string }> = [
  { key: 'manual', label: 'I type it' },
  { key: 'tasks', label: 'Tasks done' },
  { key: 'phases', label: 'Phases complete' },
];

const MAX_MILESTONES = 6;

function MetricForm({
  item,
  onSave,
  onClose,
}: Omit<DialogProps, 'item'> & { item: CanvasItem }) {
  const [title, setTitle] = useState(item.data.title ?? '');
  const [source, setSource] = useState<CanvasMetricSource>(
    item.data.metricSource ?? 'manual',
  );
  const [value, setValue] = useState(item.data.value ?? '');
  const [goal, setGoal] = useState(item.data.goal ?? '');
  const [unit, setUnit] = useState(item.data.unit ?? '');
  const [start, setStart] = useState(item.data.start ?? '');
  const [startDate, setStartDate] = useState(item.data.startDate ?? '');
  const [dueDate, setDueDate] = useState(item.data.dueDate ?? '');
  const [milestones, setMilestones] = useState<CanvasMilestone[]>(
    item.data.milestones ?? [],
  );
  const [text, setText] = useState(item.data.text ?? '');
  const [color, setColor] = useState<CanvasColorKey>(
    (item.data.color as CanvasColorKey | undefined) ?? 'green',
  );

  const manual = source === 'manual';
  const progress = manual ? metricProgress(value, goal) : null;

  const startDay = parseIsoDate(startDate);
  const dueDay = parseIsoDate(dueDate);
  const datesInvalid = Boolean(startDay && dueDay && dueDay <= startDay);

  const updateMilestone = (index: number, patch: Partial<CanvasMilestone>) =>
    setMilestones((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const submit = () => {
    if (datesInvalid) return;
    const now = new Date();
    const cleanMilestones = milestones
      .map((row) => ({
        label: row.label.trim(),
        goal: row.goal.trim(),
        dueDate: row.dueDate || undefined,
      }))
      .filter((row) => parseMetricNumber(row.goal) !== null);

    const reading = manual ? parseMetricNumber(value) : null;
    const last = item.data.history?.[item.data.history.length - 1];
    const history =
      reading !== null && reading !== last?.value
        ? logMetricPoint(item.data.history, reading, now)
        : item.data.history;

    const isTracking = Boolean(dueDate) || cleanMilestones.length > 0;
    const size = totalizerSize(
      cleanMilestones.length + (goal.trim() || !manual ? 1 : 0),
    );
    const grow =
      isTracking &&
      ((item.w ?? 0) < size.w || (item.h ?? 0) < size.h) &&
      !hadTracking(item.data);

    onSave(
      item.id,
      {
        title: title.trim() || undefined,
        metricSource: manual ? undefined : source,
        value: manual ? value.trim() || undefined : undefined,
        goal: goal.trim() || undefined,
        unit: unit.trim() || undefined,
        start: isTracking ? start.trim() || undefined : undefined,
        startDate: isTracking ? startDate || toIsoDate(now) : undefined,
        dueDate: dueDate || undefined,
        milestones: cleanMilestones.length ? cleanMilestones : undefined,
        history,
        text: text.trim() || undefined,
        color,
      },
      grow
        ? {
            w: Math.max(item.w ?? 0, size.w),
            h: Math.max(item.h ?? 0, size.h),
          }
        : undefined,
    );
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Figure or target</DialogTitle>
        <DialogDescription>
          A big number to keep in view. Add a due date to track it against a
          plan, with pace, time left and milestones.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="canvas-metric-title">What is it?</Label>
          <Input
            id="canvas-metric-title"
            value={title}
            maxLength={200}
            placeholder="Paying users now"
            autoFocus
            className="text-base"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>Where does the number come from?</Label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={source === option.key}
                onClick={() => setSource(option.key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  source === option.key
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {manual ? null : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Counted live from this project. Leave the target blank to aim for
              all of them.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {manual ? (
            <div className="space-y-1">
              <Label htmlFor="canvas-metric-value">Right now</Label>
              <Input
                id="canvas-metric-value"
                value={value}
                maxLength={60}
                placeholder="£8,400 or 2"
                className="text-base"
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="canvas-metric-goal">Target</Label>
            <Input
              id="canvas-metric-goal"
              value={goal}
              maxLength={60}
              placeholder="£12,000 or 105"
              className="text-base"
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="canvas-metric-unit">What are we counting?</Label>
            <Input
              id="canvas-metric-unit"
              value={unit}
              maxLength={40}
              placeholder="paying users"
              className="text-base"
              onChange={(event) => setUnit(event.target.value)}
            />
          </div>
        </div>
        {progress !== null ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {Math.round(progress * 100)}% of the way there
          </p>
        ) : null}

        <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
          <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            By when
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="canvas-metric-due">Due date</Label>
              <Input
                id="canvas-metric-due"
                type="date"
                value={dueDate}
                className="text-base"
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="canvas-metric-start-date">Started on</Label>
              <Input
                id="canvas-metric-start-date"
                type="date"
                value={startDate}
                className="text-base"
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="canvas-metric-start">Starting number</Label>
              <Input
                id="canvas-metric-start"
                value={start}
                maxLength={60}
                placeholder="0"
                className="text-base"
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
          </div>
          {datesInvalid ? (
            <p className="text-xs text-[var(--ozer-danger,#dc2626)]">
              The due date has to be after the start date.
            </p>
          ) : null}

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label>Milestones</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={milestones.length >= MAX_MILESTONES}
                onClick={() =>
                  setMilestones((rows) => [
                    ...rows,
                    { label: `M${rows.length + 1}`, goal: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {milestones.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1.3fr_auto] items-center gap-2"
              >
                <Input
                  aria-label="Milestone name"
                  value={row.label}
                  maxLength={60}
                  placeholder="Name"
                  onChange={(event) =>
                    updateMilestone(index, { label: event.target.value })
                  }
                />
                <Input
                  aria-label="Milestone target"
                  value={row.goal}
                  maxLength={60}
                  placeholder="Target"
                  onChange={(event) =>
                    updateMilestone(index, { goal: event.target.value })
                  }
                />
                <Input
                  aria-label="Milestone date"
                  type="date"
                  value={row.dueDate ?? ''}
                  onChange={(event) =>
                    updateMilestone(index, {
                      dueDate: event.target.value || undefined,
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove milestone"
                  className="rounded p-1 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  onClick={() =>
                    setMilestones((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="canvas-metric-note">Notes</Label>
          <Textarea
            id="canvas-metric-note"
            value={text}
            rows={2}
            maxLength={2000}
            placeholder="How we'll get there, who owns it…"
            className="text-base"
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {CANVAS_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={color === key}
                onClick={() => setColor(key)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 border-transparent transition-transform',
                  color === key &&
                    'scale-110 border-[var(--workspace-shell-text)]',
                )}
                style={{ background: CANVAS_COLORS[key].stroke }}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={datesInvalid}>
            Save
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function hadTracking(data: CanvasItemData) {
  return Boolean(data.dueDate) || (data.milestones?.length ?? 0) > 0;
}
