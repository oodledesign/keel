'use client';

import { useState, useTransition } from 'react';

import { Archive, Loader2, Trash2 } from 'lucide-react';

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
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';

import {
  archiveInstruction,
  archiveRequirement,
  deleteInstructionForever,
  deleteRequirementForever,
  restoreInstruction,
  restoreRequirement,
} from '../_lib/server/wip-archive.actions';

export type WipArchiveKind = 'instruction' | 'requirement';

const COPY: Record<
  WipArchiveKind,
  { noun: string; archiveHint: string; deleteLoses: string }
> = {
  instruction: {
    noun: 'instruction',
    archiveHint:
      'Hidden from the WIP board, totals, reports and match suggestions. You can restore it from Archived.',
    deleteLoses:
      'Its compliance and client-care records are deleted with it. Notes and tasks stay, but are no longer linked to it.',
  },
  requirement: {
    noun: 'requirement',
    archiveHint:
      'Hidden from the WIP board, matching and circulation. You can restore it from Archived.',
    deleteLoses:
      'Its listing matches and interest are deleted with it. Notes and tasks stay, but are no longer linked to it.',
  },
};

/**
 * Archive and delete for a WIP instruction or requirement. Archive is
 * reversible (Undo toast, and the Archived list). Delete is permanent, so it
 * sits behind a confirmation and only shows for owners and admins.
 */
export function WipArchiveControls({
  kind,
  accountId,
  accountSlug,
  recordId,
  recordName,
  canDelete,
  onRemoved,
  onRestored,
}: {
  kind: WipArchiveKind;
  accountId: string;
  accountSlug?: string | null;
  recordId: string;
  recordName: string;
  canDelete: boolean;
  /** The record was archived or deleted, so the host should close and drop it. */
  onRemoved: () => void;
  /** Undo restored an archived record, so the host should reload. */
  onRestored: () => void;
}) {
  const copy = COPY[kind];
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = recordName.trim() || `this ${copy.noun}`;

  const scope = {
    accountId,
    accountSlug: accountSlug?.trim() || undefined,
    id: recordId,
  };

  function restore() {
    const action =
      kind === 'instruction' ? restoreInstruction : restoreRequirement;
    action(scope)
      .then(() => {
        toast.success(`${capitalise(copy.noun)} restored`);
        onRestored();
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        const action =
          kind === 'instruction' ? archiveInstruction : archiveRequirement;
        await action(scope);
        toast.success(`${capitalise(copy.noun)} archived`, {
          description: name,
          action: { label: 'Undo', onClick: restore },
        });
        onRemoved();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const action =
          kind === 'instruction'
            ? deleteInstructionForever
            : deleteRequirementForever;
        await action(scope);
        setConfirmOpen(false);
        toast.success(`${capitalise(copy.noun)} deleted`);
        onRemoved();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  }

  return (
    <div className="flex items-center gap-2" data-test="wip-archive-controls">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        title={copy.archiveHint}
        data-test="wip-archive-button"
        onClick={handleArchive}
      >
        {isPending && !confirmOpen ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <Archive aria-hidden className="h-4 w-4" />
        )}
        Archive
      </Button>

      {canDelete ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-haspopup="dialog"
            data-test="wip-delete-button"
            className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            Delete
          </Button>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            {/* React events bubble through portals; keep them off the form. */}
            <AlertDialogContent
              data-test="wip-delete-confirm-dialog"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete this {copy.noun} permanently?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-[var(--workspace-shell-text-muted)]">
                  <span className="block">
                    “{name}” will be removed for everyone and can&apos;t be
                    recovered.
                  </span>
                  <span className="block">{copy.deleteLoses}</span>
                  <span className="block">
                    If you might need it again, archive it instead.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isPending}
                  data-test="wip-delete-confirm-cancel"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  data-test="wip-delete-confirm-action"
                  className="bg-rose-600 text-white hover:bg-rose-700"
                  onClick={(event) => {
                    // Keep the dialog open until the delete has finished.
                    event.preventDefault();
                    handleDelete();
                  }}
                >
                  {isPending ? 'Deleting…' : 'Delete permanently'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
