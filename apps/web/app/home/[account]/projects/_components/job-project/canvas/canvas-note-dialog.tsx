'use client';

import { useEffect, useState } from 'react';

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
import { toast } from '@kit/ui/sonner';

import { NoteBodyEditor } from '../../../../notes/_components/note-body-editor';
import { getErrorMessage } from '../../../_lib/error-message';
import type { ProjectCanvasNote } from '../../../_lib/schema/project-canvas.schema';
import {
  createProjectCanvasNote,
  loadProjectCanvasNote,
  updateProjectCanvasNote,
} from '../../../_lib/server/project-canvas.actions';

type NoteDraft = { title: string; content: string };

const EMPTY_DRAFT: NoteDraft = { title: '', content: '' };

/**
 * Edit a project note, or write a new one (`noteId` of `'new'`) that's saved
 * to the project and placed on the canvas.
 */
export function CanvasNoteDialog({
  accountId,
  jobId,
  noteId,
  onOpenChange,
  onSaved,
  onCreated,
}: {
  accountId: string;
  jobId: string;
  noteId: string | 'new' | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: ProjectCanvasNote) => void;
  onCreated: (note: ProjectCanvasNote) => void;
}) {
  const creating = noteId === 'new';
  return (
    <Dialog open={Boolean(noteId)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {creating ? 'New project note' : 'Edit note'}
          </DialogTitle>
          {creating ? (
            <DialogDescription>
              Saved to this project&apos;s notes and added to the canvas.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {noteId ? (
          <NoteEditorBody
            key={noteId}
            accountId={accountId}
            jobId={jobId}
            noteId={creating ? null : noteId}
            onClose={() => onOpenChange(false)}
            onSaved={creating ? onCreated : onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteEditorBody({
  accountId,
  jobId,
  noteId,
  onClose,
  onSaved,
}: {
  accountId: string;
  jobId: string;
  /** Null while writing a new note. */
  noteId: string | null;
  onClose: () => void;
  onSaved: (note: ProjectCanvasNote) => void;
}) {
  const [initial, setInitial] = useState<NoteDraft | null>(
    noteId ? null : EMPTY_DRAFT,
  );
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    loadProjectCanvasNote({ accountId, jobId, noteId })
      .then((note) => {
        if (cancelled) return;
        const loaded = { title: note.title ?? '', content: note.content };
        setInitial(loaded);
        setDraft(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, jobId, noteId]);

  const dirty =
    initial !== null &&
    (draft.title !== initial.title || draft.content !== initial.content);
  const empty = !draft.title.trim() && !draft.content.trim();

  const save = async () => {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const note = noteId
        ? await updateProjectCanvasNote({
            accountId,
            jobId,
            noteId,
            title: draft.title,
            content: draft.content,
          })
        : await createProjectCanvasNote({
            accountId,
            jobId,
            title: draft.title,
            content: draft.content,
          });
      onSaved(note);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <p className="py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Couldn&apos;t load this note: {loadError}
      </p>
    );
  }

  if (!initial) {
    return (
      <div className="h-64 animate-pulse rounded-lg bg-[var(--workspace-control-surface)]/50" />
    );
  }

  return (
    <>
      <Input
        value={draft.title}
        autoFocus={!noteId}
        placeholder="Untitled note"
        onChange={(event) =>
          setDraft((prev) => ({ ...prev, title: event.target.value }))
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
        className="font-heading h-10 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-base font-semibold"
      />
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[color:var(--workspace-shell-border)] [&_.note-body-editor]:min-h-[40vh] [&_.note-body-editor]:px-4 [&_.note-body-editor]:pb-6 [&_.note-body-editor]:lg:px-5">
        <NoteBodyEditor
          initialMarkdown={initial.content}
          onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
          toolbarClassName="sticky top-0 bottom-auto z-10 justify-start border-t-0 border-b bg-[var(--ozer-surface-panel)] pb-1.5"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving || (!noteId && empty)}
          onClick={save}
        >
          {saving ? 'Saving…' : noteId ? 'Save note' : 'Add note'}
        </Button>
      </DialogFooter>
    </>
  );
}
