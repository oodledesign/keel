'use client';

import { useState, useTransition } from 'react';

import { Pin } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '../../_lib/error-message';
import {
  addPhaseNote,
  updatePhaseNote,
} from '../../_lib/server/server-actions';

export type PhaseNote = {
  id: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

function formatNoteDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PhaseNotesPanel({
  accountId,
  accountSlug,
  jobId,
  phaseId,
  initialNotes,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  phaseId: string;
  initialNotes: PhaseNote[];
  canEdit: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [, startTransition] = useTransition();

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const togglePin = (note: PhaseNote) => {
    if (!canEdit) return;
    const next = !note.is_pinned;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, is_pinned: next } : n)),
    );
    startTransition(async () => {
      try {
        await updatePhaseNote({
          accountId,
          accountSlug,
          jobId,
          phaseId,
          noteId: note.id,
          isPinned: next,
        });
      } catch (err) {
        toast.error(getErrorMessage(err));
        setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
      }
    });
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    startTransition(async () => {
      try {
        const row = await addPhaseNote({
          accountId,
          accountSlug,
          jobId,
          phaseId,
          content,
          title: draftTitle.trim() || undefined,
        });
        setNotes((prev) => [row as PhaseNote, ...prev]);
        setDraft('');
        setDraftTitle('');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Notes
      </h2>
      <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
        Pinned notes appear first
      </p>

      {canEdit && (
        <form
          onSubmit={addNote}
          className="mt-3 space-y-2 border-b border-[color:var(--workspace-shell-border)] pb-4"
        >
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title (optional)"
            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
          />
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Quick note for this phase…"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!draft.trim()}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            Add note
          </Button>
        </form>
      )}

      <ul className="mt-3 space-y-3">
        {sortedNotes.length === 0 && (
          <li className="text-sm text-[var(--workspace-shell-text-muted)]">
            No notes yet.
          </li>
        )}
        {sortedNotes.map((note) => (
          <li
            key={note.id}
            className={cn(
              'rounded-lg border px-3 py-2.5',
              note.is_pinned
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              {note.title ? (
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {note.title}
                </p>
              ) : null}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => togglePin(note)}
                  className={cn(
                    'shrink-0 rounded p-1',
                    note.is_pinned
                      ? 'text-amber-400'
                      : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text-muted)]',
                  )}
                  aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
              {note.content}
            </p>
            <p className="mt-2 text-[10px] text-[var(--workspace-shell-text-muted)]">
              {formatNoteDate(note.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
