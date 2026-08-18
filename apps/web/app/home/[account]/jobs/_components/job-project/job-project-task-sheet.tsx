'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ExternalLink, Link2, Plus, StickyNote, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import { listNotesAndFilesForContextAction } from '~/home/[account]/_lib/workspace-content/notes-files-actions';

import { getErrorMessage } from '../../_lib/error-message';
import type { JobBoardTask } from '../../_lib/schema/project-phases.schema';
import { deleteJobTask, updateJobTask } from '../../_lib/server/server-actions';

type TaskLinkDraft = { url: string; label: string };
type NoteRefDraft = { id: string; title: string };
type PickerNote = { id: string; title: string; preview: string };

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function JobProjectTaskSheet({
  open,
  onOpenChange,
  task,
  accountId,
  accountSlug,
  jobId,
  canEditJobs,
  onUpdated,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: JobBoardTask | null;
  accountId: string;
  accountSlug: string;
  jobId: string;
  canEditJobs: boolean;
  onUpdated: (task: JobBoardTask) => void;
  onDeleted?: (task: JobBoardTask) => void;
}) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<TaskLinkDraft[]>([]);
  const [noteRefs, setNoteRefs] = useState<NoteRefDraft[]>([]);
  const [pickerNotes, setPickerNotes] = useState<PickerNote[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!task || !open) return;
    setTitle(task.title);
    setStatus(task.status || 'todo');
    setPriority(task.priority || 'medium');
    setDueDate(task.due_date ?? '');
    setNotes(task.notes ?? '');
    setLinks(
      (task.links ?? []).map((link) => ({
        url: link.url,
        label: link.label ?? '',
      })),
    );
    setNoteRefs(
      (task.note_refs ?? []).map((ref) => ({
        id: ref.id,
        title: ref.title,
      })),
    );
    setPickerQuery('');
    setPickerOpen(false);
    setDeleteOpen(false);
  }, [open, task]);

  useEffect(() => {
    if (!open || !pickerOpen || !accountId) return;
    let cancelled = false;
    setPickerLoading(true);
    void listNotesAndFilesForContextAction({ accountId })
      .then((result) => {
        if (cancelled) return;
        const notesOnly = (result.items ?? [])
          .filter((item) => item.type === 'note')
          .map((item) => ({
            id: item.id,
            title: item.title,
            preview: item.preview,
          }));
        setPickerNotes(notesOnly);
      })
      .catch(() => {
        if (!cancelled) setPickerNotes([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, open, pickerOpen]);

  const attachedIds = useMemo(
    () => new Set(noteRefs.map((ref) => ref.id)),
    [noteRefs],
  );

  const filteredPickerNotes = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return pickerNotes
      .filter((note) => !attachedIds.has(note.id))
      .filter((note) => {
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) ||
          note.preview.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [attachedIds, pickerNotes, pickerQuery]);

  if (!task) return null;

  const noteDetailPath = (noteId: string) =>
    pathsConfig.app.accountNoteDetail
      .replace('[account]', accountSlug)
      .replace('[noteId]', noteId);

  const handleSave = () => {
    if (!canEditJobs) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title is required');
      return;
    }

    const nextLinks = links
      .map((link) => ({
        url: normalizeUrl(link.url),
        label: link.label.trim() || null,
      }))
      .filter((link) => link.url);

    startTransition(async () => {
      try {
        const updated = await updateJobTask({
          accountId,
          accountSlug,
          jobId,
          taskId: task.id,
          title: trimmedTitle,
          status: status as
            | 'todo'
            | 'in_progress'
            | 'client_review'
            | 'done'
            | 'cancelled',
          priority: priority as 'low' | 'medium' | 'high' | 'urgent',
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes.trim() || null,
          links: nextLinks,
          noteRefs,
        });
        onUpdated(updated as JobBoardTask);
        toast.success('Task updated');
        onOpenChange(false);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  const handleDelete = () => {
    if (!canEditJobs || !task) return;
    startTransition(async () => {
      try {
        await deleteJobTask({
          accountId,
          accountSlug,
          jobId,
          taskId: task.id,
        });
        onDeleted?.(task);
        setDeleteOpen(false);
        onOpenChange(false);
        toast.success('Task deleted');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] pb-4 text-left">
            <SheetTitle className="text-[var(--workspace-shell-text)]">
              Task
            </SheetTitle>
            <SheetDescription className="text-[var(--workspace-shell-text-muted)]">
              Attach workspace notes and links, or keep a short scratch note on
              the task itself.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 py-4">
            <div>
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEditJobs || pending}
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  disabled={!canEditJobs || pending}
                >
                  <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To do</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="client_review">Client review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Priority
                </Label>
                <Select
                  value={priority}
                  onValueChange={setPriority}
                  disabled={!canEditJobs || pending}
                >
                  <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Due date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canEditJobs || pending}
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Attached notes
                </Label>
                {canEditJobs ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[var(--workspace-shell-text-muted)]"
                    disabled={pending || noteRefs.length >= 30}
                    onClick={() => setPickerOpen((openState) => !openState)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Attach note
                  </Button>
                ) : null}
              </div>

              {pickerOpen ? (
                <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 p-2.5">
                  <Input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search workspace notes…"
                    className="mb-2 h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
                    autoFocus
                  />
                  {pickerLoading ? (
                    <p className="px-1 py-3 text-xs text-[var(--workspace-shell-text-muted)]">
                      Loading notes…
                    </p>
                  ) : filteredPickerNotes.length === 0 ? (
                    <p className="px-1 py-3 text-xs text-[var(--workspace-shell-text-muted)]">
                      No matching notes.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {filteredPickerNotes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-[var(--workspace-shell-sidebar-accent)]"
                          onClick={() => {
                            setNoteRefs((prev) => [
                              ...prev,
                              { id: note.id, title: note.title },
                            ]);
                            setPickerOpen(false);
                            setPickerQuery('');
                          }}
                        >
                          <span className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                            {note.title}
                          </span>
                          {note.preview ? (
                            <span className="line-clamp-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                              {note.preview}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {noteRefs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
                  Attach project, client, or any other workspace notes without
                  moving them out of the notes library.
                </p>
              ) : (
                <div className="space-y-2">
                  {noteRefs.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-start gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 p-2.5"
                    >
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={noteDetailPath(ref.id)}
                          className="block truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent)] hover:underline"
                        >
                          {ref.title}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                          Workspace note
                        </p>
                      </div>
                      {canEditJobs ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 p-0 text-[var(--workspace-shell-text-muted)]"
                          disabled={pending}
                          onClick={() =>
                            setNoteRefs((prev) =>
                              prev.filter((item) => item.id !== ref.id),
                            )
                          }
                          aria-label="Detach note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Scratch notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEditJobs || pending}
                placeholder="Quick notes that live only on this task…"
                className="mt-1 min-h-[110px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Links
                </Label>
                {canEditJobs ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[var(--workspace-shell-text-muted)]"
                    disabled={pending || links.length >= 20}
                    onClick={() =>
                      setLinks((prev) => [...prev, { url: '', label: '' }])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add link
                  </Button>
                ) : null}
              </div>

              {links.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
                  No links yet. Add drive docs, Figma files, specs, or tickets.
                </p>
              ) : (
                <div className="space-y-2">
                  {links.map((link, index) => (
                    <div
                      key={`link-${index}`}
                      className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <Link2 className="mt-2.5 h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            value={link.url}
                            onChange={(e) =>
                              setLinks((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, url: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="https://…"
                            disabled={!canEditJobs || pending}
                            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
                          />
                          <Input
                            value={link.label}
                            onChange={(e) =>
                              setLinks((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, label: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Label (optional)"
                            disabled={!canEditJobs || pending}
                            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
                          />
                          {link.url.trim() ? (
                            <a
                              href={normalizeUrl(link.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[var(--ozer-accent)] hover:underline"
                            >
                              Open
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                        {canEditJobs ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 p-0 text-[var(--workspace-shell-text-muted)]"
                            disabled={pending}
                            onClick={() =>
                              setLinks((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            aria-label="Remove link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {canEditJobs ? (
            <div className="flex shrink-0 gap-2 border-t border-[color:var(--workspace-shell-border)] pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] text-red-400 hover:bg-red-500/10 hover:text-red-300"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                disabled={pending}
                onClick={handleSave}
              >
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={pending}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              className="bg-red-600 hover:bg-red-500"
              onClick={handleDelete}
            >
              {pending ? 'Deleting…' : 'Delete task'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
