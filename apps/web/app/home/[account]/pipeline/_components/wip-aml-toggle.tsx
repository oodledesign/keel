'use client';

import { useState } from 'react';

import { Check } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { cn } from '@kit/ui/utils';

/**
 * AML done tick for a WIP instruction. Every change goes through a
 * confirmation step so it can't be flipped by an accidental click.
 * Un-ticking is confirmed too, because it clears who marked it and when.
 */
export function WipAmlToggle({
  done,
  doneAt,
  instructionName,
  disabled = false,
  onToggle,
  className,
}: {
  done: boolean;
  doneAt?: string | null;
  /** Shown in the confirmation so people know which instruction they are changing. */
  instructionName?: string | null;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Snapshot of what the person is confirming, taken when the dialog opens,
  // so a live update to `done` can't flip the action under them.
  const [pendingNext, setPendingNext] = useState(false);

  const doneLabel = doneAt
    ? `AML done ${new Date(doneAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })}`
    : 'AML done';

  const next = pendingNext;
  const subject = instructionName?.trim()
    ? `“${instructionName.trim()}”`
    : 'this instruction';

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={done ? doneLabel : 'AML not done'}
        title={done ? doneLabel : 'AML not done'}
        disabled={disabled}
        data-test="wip-aml-toggle"
        data-aml-done={done ? 'true' : 'false'}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold tracking-wide transition-colors',
          done
            ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100'
            : 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100',
          disabled ? 'cursor-wait opacity-60' : 'hover:brightness-95',
          className,
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (disabled) return;
          setPendingNext(!done);
          setConfirmOpen(true);
        }}
      >
        {done ? (
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.75} />
        ) : null}
        <span>AML</span>
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        {/*
          React events bubble through portals, so keep clicks and pointer
          presses inside the dialog from reaching the row (expand / drag)
          or a surrounding form.
        */}
        <AlertDialogContent
          data-test="wip-aml-confirm-dialog"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {next ? 'Mark AML as done?' : 'Mark AML as not done?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              {next
                ? `Confirm that the AML checks for ${subject} are complete. This records your name and today's date.`
                : `This will clear the AML done tick for ${subject}, along with who marked it and when.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-test="wip-aml-confirm-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-test="wip-aml-confirm-action"
              onClick={() => onToggle(next)}
            >
              {next ? 'Yes, AML is done' : 'Yes, mark not done'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
