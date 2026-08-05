'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';

export function SaveProjectAsTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  phaseCount,
  taskCount,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  phaseCount: number;
  taskCount: number;
  onSave: (input: {
    name: string;
    description?: string;
  }) => Promise<{ name: string; phaseCount: number; taskCount: number }>;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription('');
  }, [defaultName, open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a template name');
      return;
    }

    startTransition(async () => {
      try {
        const result = await onSave({
          name: trimmed,
          description: description.trim() || undefined,
        });
        toast.success(
          `Saved “${result.name}” (${result.phaseCount} phases${
            result.taskCount > 0 ? `, ${result.taskCount} tasks` : ''
          })`,
        );
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not save template',
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as workspace template</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Saves phase names, order, colours, descriptions, and task titles for
            this workspace. Assignees, dates, and statuses are not included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div>
            <Label
              htmlFor="phase-template-name"
              className="text-xs text-[var(--workspace-shell-text-muted)]"
            >
              Template name
            </Label>
            <Input
              id="phase-template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              placeholder="e.g. Brand identity board"
              maxLength={120}
              disabled={pending}
            />
          </div>
          <div>
            <Label
              htmlFor="phase-template-description"
              className="text-xs text-[var(--workspace-shell-text-muted)]"
            >
              Description (optional)
            </Label>
            <Textarea
              id="phase-template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[80px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              placeholder="When should the team use this template?"
              maxLength={500}
              disabled={pending}
            />
          </div>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Will save {phaseCount} phase{phaseCount === 1 ? '' : 's'}
            {taskCount > 0
              ? ` and ${taskCount} task title${taskCount === 1 ? '' : 's'}`
              : ''}
            .
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            disabled={pending || phaseCount === 0}
            onClick={handleSave}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
