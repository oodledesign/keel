'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  workspaceBorder,
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type {
  SurveyObservation,
  SurveyTranscriptNotesPreview,
} from '../_lib/schema/survey-capture.schema';
import { applySurveyTranscriptNotesAction } from '../_lib/server/survey-capture-actions';

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function submitLabel(adding: number, removing: number) {
  if (adding > 0 && removing > 0) {
    return `Add ${plural(adding, 'note')}, remove ${removing}`;
  }
  if (removing > 0) return `Remove ${plural(removing, 'note')}`;
  return `Add ${plural(adding, 'note')}`;
}

export function SurveyTranscriptSortDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  proposalId,
  transcriptId,
  transcriptTitle,
  preview,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  proposalId: string;
  transcriptId: string;
  transcriptTitle: string;
  preview: SurveyTranscriptNotesPreview;
  onApplied: (result: {
    observations: SurveyObservation[];
    removed: number;
  }) => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(preview.drafts.map((_, index) => index)),
  );
  const [kept, setKept] = useState(
    () => new Set(preview.existingNotes.map((note) => note.id)),
  );
  const [pending, startTransition] = useTransition();

  const removeIds = preview.existingNotes
    .filter((note) => !kept.has(note.id))
    .map((note) => note.id);
  const canSubmit = !pending && (selected.size > 0 || removeIds.length > 0);

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const apply = () => {
    startTransition(async () => {
      try {
        const result = await applySurveyTranscriptNotesAction({
          accountId,
          accountSlug,
          proposalId,
          transcriptId,
          notes: preview.drafts
            .filter((_, index) => selected.has(index))
            .map((draft) => ({
              sectionKey: draft.sectionKey,
              body: draft.body,
              sourceBody: draft.sourceBody,
              cleanupSource: draft.cleanupSource,
            })),
          removeObservationIds: removeIds,
        });
        onApplied(result);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const allSelected = selected.size === preview.drafts.length;
  const allKept = kept.size === preview.existingNotes.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-test="survey-transcript-sort-dialog"
      >
        <DialogHeader>
          <DialogTitle>Sort into notes</DialogTitle>
          <DialogDescription>
            {transcriptTitle}. Tick the notes to add to Content review.
          </DialogDescription>
        </DialogHeader>

        {preview.groupingSource === 'keyword_fallback' ? (
          <p className={`text-xs ${workspaceTextMuted}`}>
            Sorted by keyword matching
            {preview.groupingFallbackReason
              ? ` (${preview.groupingFallbackReason})`
              : ''}
            , so check the sections before adding.
          </p>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              New notes ({selected.size} of {preview.drafts.length})
            </h4>
            {preview.drafts.length > 0 ? (
              <button
                type="button"
                className={`text-xs font-medium ${workspaceLinkAccent}`}
                onClick={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(preview.drafts.map((_, index) => index)),
                  )
                }
                data-test="survey-sort-select-all"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            ) : null}
          </div>
          {preview.drafts.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No usable notes were found in this visit. Add more complete
              sentences to the visit text and try again.
            </p>
          ) : (
            <ul
              className={`divide-y rounded-xl border ${workspaceBorder} divide-[color:var(--workspace-shell-border)]`}
            >
              {preview.drafts.map((draft, index) => {
                const id = `survey-sort-draft-${index}`;
                return (
                  <li key={id} className="flex items-start gap-3 px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={selected.has(index)}
                      disabled={pending}
                      onCheckedChange={() =>
                        setSelected((prev) => toggle(prev, index))
                      }
                      className="mt-0.5"
                      data-test="survey-sort-draft-checkbox"
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                      <span
                        className={`block text-xs font-medium ${workspaceTextMuted}`}
                      >
                        {draft.sectionLabel}
                      </span>
                      <span className="mt-0.5 block whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                        {draft.body}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {preview.existingNotes.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Notes already made from this visit
              </h4>
              <button
                type="button"
                className={`text-xs font-medium ${workspaceLinkAccent}`}
                onClick={() =>
                  setKept(
                    allKept
                      ? new Set()
                      : new Set(preview.existingNotes.map((note) => note.id)),
                  )
                }
                data-test="survey-sort-keep-all"
              >
                {allKept ? 'Replace all' : 'Keep all'}
              </button>
            </div>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Ticked notes are kept, including any edits you made in Content
              review. Untick the ones you want to replace.
            </p>
            <ul
              className={`divide-y rounded-xl border ${workspaceBorder} divide-[color:var(--workspace-shell-border)]`}
            >
              {preview.existingNotes.map((note) => {
                const id = `survey-sort-existing-${note.id}`;
                const isKept = kept.has(note.id);
                return (
                  <li
                    key={note.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <Checkbox
                      id={id}
                      checked={isKept}
                      disabled={pending}
                      onCheckedChange={() =>
                        setKept((prev) => toggle(prev, note.id))
                      }
                      className="mt-0.5"
                      data-test="survey-sort-existing-checkbox"
                    />
                    <label
                      htmlFor={id}
                      className={`min-w-0 flex-1 text-sm ${
                        isKept ? '' : 'line-through opacity-60'
                      }`}
                    >
                      <span
                        className={`block text-xs font-medium ${workspaceTextMuted}`}
                      >
                        {note.sectionLabel}
                      </span>
                      <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                        {note.body}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={!canSubmit}
            onClick={apply}
            data-test="survey-sort-submit"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel(selected.size, removeIds.length)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
