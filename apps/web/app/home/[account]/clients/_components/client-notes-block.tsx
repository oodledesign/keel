'use client';

import { useCallback, useEffect, useState } from 'react';

import { PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import {
  createNote,
  deleteNote,
  listNotes,
} from '../_lib/server/server-actions';

type NoteRow = {
  id: string;
  note: string;
  author_user_id: string;
  created_at: string;
};

export function ClientNotesBlock({
  accountId,
  clientId,
  canEdit,
  onNoteAdded,
}: {
  accountId: string;
  clientId: string;
  canEdit: boolean;
  onNoteAdded?: () => void;
}) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotes({ accountId, clientId });
      setNotes((data ?? []) as unknown as NoteRow[]);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !canEdit) return;
    setSubmitting(true);
    try {
      await createNote({ accountId, clientId, note: newNote.trim() });
      setNewNote('');
      await fetchNotes();
      onNoteAdded?.();
      toast.success('Note added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!canEdit) return;
    try {
      await deleteNote({ accountId, noteId });
      await fetchNotes();
      onNoteAdded?.();
      toast.success('Note deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete note');
    }
  };

  if (!canEdit && notes.length === 0) return null;

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Notes</h3>
      {canEdit && (
        <form onSubmit={handleAddNote} className="space-y-2">
          <Label htmlFor="new-note">Add note</Label>
          <Textarea
            id="new-note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Internal note..."
            rows={3}
            className="resize-none"
          />
          <Button type="submit" size="sm" disabled={submitting || !newNote.trim()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {submitting ? 'Adding...' : 'Add note'}
          </Button>
        </form>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap">{note.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => handleDelete(note.id)}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
