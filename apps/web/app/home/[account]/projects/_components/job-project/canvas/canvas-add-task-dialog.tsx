'use client';

import { useState } from 'react';

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

export type NewCanvasTask = {
  title: string;
  phaseId: string | null;
  dueDate: string | null;
};

const NO_PHASE = '';

const fieldClass =
  'w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-2 text-base text-[var(--workspace-shell-text)]';

/** Quick "new task" form for the canvas. */
export function CanvasAddTaskDialog({
  open,
  phases,
  defaultPhaseId,
  canPickPhase,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  phases: Array<{ id: string; name: string }>;
  defaultPhaseId: string | null;
  /** Guests add tasks without choosing a phase. */
  canPickPhase: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (task: NewCanvasTask) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        {open ? (
          <TaskForm
            phases={phases}
            defaultPhaseId={defaultPhaseId}
            canPickPhase={canPickPhase}
            onCancel={() => onOpenChange(false)}
            onCreate={onCreate}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  phases,
  defaultPhaseId,
  canPickPhase,
  onCancel,
  onCreate,
}: {
  phases: Array<{ id: string; name: string }>;
  defaultPhaseId: string | null;
  canPickPhase: boolean;
  onCancel: () => void;
  onCreate: (task: NewCanvasTask) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [phaseId, setPhaseId] = useState(defaultPhaseId ?? NO_PHASE);
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreate({
        title: trimmed,
        phaseId: phaseId || null,
        dueDate: dueDate || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add task</DialogTitle>
        <DialogDescription>
          It&apos;s added to the project board and appears on the canvas.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="canvas-task-title">Task</Label>
          <Input
            id="canvas-task-title"
            data-test="canvas-task-title"
            value={title}
            maxLength={500}
            autoFocus
            placeholder="What needs doing?"
            className="text-base"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        {canPickPhase ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="canvas-task-phase">Phase</Label>
              <select
                id="canvas-task-phase"
                value={phaseId}
                onChange={(event) => setPhaseId(event.target.value)}
                className={fieldClass}
              >
                <option value={NO_PHASE}>No phase</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="canvas-task-due">Due date</Label>
              <Input
                id="canvas-task-due"
                type="date"
                value={dueDate}
                className="text-base"
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            data-test="canvas-task-submit"
            disabled={busy || !title.trim()}
          >
            {busy ? 'Adding…' : 'Add task'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
