'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Pencil, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  type WipAttachmentNote,
  type WipAttachmentTask,
  createWipAttachmentNote,
  createWipAttachmentTask,
  listWipAttachmentNotes,
  listWipAttachmentTasks,
  listWipTeamMembers,
  updateWipAttachmentNote,
} from '../_lib/server/wip-attachments.actions';

type Props = {
  accountId: string;
  accountSlug?: string | null;
  pipelineDealId?: string | null;
  commercialRequirementId?: string | null;
  /** Compact mode for ladder row expand (activity only). */
  activityOnly?: boolean;
  /** When activityOnly, how many notes to show before "View all". */
  previewCount?: number;
  onActivityChanged?: () => void;
};

function formatTimelineDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function toDateInputValue(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function dateInputToIso(dateValue: string) {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;
  // Noon UTC avoids timezone day-shift for date-only picks.
  return new Date(`${trimmed}T12:00:00.000Z`).toISOString();
}

export function WipAttachmentsStrip({
  accountId,
  accountSlug,
  pipelineDealId,
  commercialRequirementId,
  activityOnly = false,
  previewCount = 3,
  onActivityChanged,
}: Props) {
  const [tasks, setTasks] = useState<WipAttachmentTask[]>([]);
  const [notes, setNotes] = useState<WipAttachmentNote[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [taskTitle, setTaskTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteDate, setNoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [assignedToUserId, setAssignedToUserId] = useState<string>('__none__');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAssignee, setEditAssignee] = useState<string>('__none__');
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [composerOpen, setComposerOpen] = useState(!activityOnly);
  const [showAllNotes, setShowAllNotes] = useState(!activityOnly);

  const scope = {
    accountId,
    accountSlug,
    pipelineDealId: pipelineDealId || null,
    commercialRequirementId: commercialRequirementId || null,
  };

  const refresh = async () => {
    if (!pipelineDealId && !commercialRequirementId) {
      setTasks([]);
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextTasks, nextNotes, nextMembers] = await Promise.all([
        activityOnly
          ? Promise.resolve([] as WipAttachmentTask[])
          : listWipAttachmentTasks(scope),
        listWipAttachmentNotes(scope),
        listWipTeamMembers({ accountId }),
      ]);
      setTasks(nextTasks);
      setNotes(nextNotes);
      setMembers(nextMembers.map((m) => ({ id: m.id, label: m.label })));
    } catch (error) {
      console.error('[wip-attachments] load failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, pipelineDealId, commercialRequirementId]);

  useEffect(() => {
    setComposerOpen(!activityOnly);
    setShowAllNotes(!activityOnly);
  }, [activityOnly, pipelineDealId, commercialRequirementId]);

  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        await createWipAttachmentTask({
          ...scope,
          title,
          dueDate: null,
        });
        setTaskTitle('');
        await refresh();
        toast.success('Task added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add task',
        );
      }
    });
  };

  const addNote = () => {
    const content = noteBody.trim();
    if (!content) return;
    startTransition(async () => {
      try {
        await createWipAttachmentNote({
          ...scope,
          content,
          title: null,
          assignedToUserId:
            assignedToUserId === '__none__' ? null : assignedToUserId,
          occurredAt: dateInputToIso(noteDate),
        });
        setNoteBody('');
        setAssignedToUserId('__none__');
        setNoteDate(new Date().toISOString().slice(0, 10));
        if (activityOnly) setComposerOpen(false);
        await refresh();
        onActivityChanged?.();
        toast.success('Update logged');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add update',
        );
      }
    });
  };

  const startEdit = (note: WipAttachmentNote) => {
    setEditingId(note.id);
    setEditBody(note.content);
    setEditDate(toDateInputValue(note.createdAt));
    setEditAssignee(note.assignedTo?.id ?? '__none__');
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    startTransition(async () => {
      try {
        await updateWipAttachmentNote({
          accountId,
          accountSlug,
          noteId: editingId,
          content: editBody.trim(),
          assignedToUserId: editAssignee === '__none__' ? null : editAssignee,
          occurredAt: dateInputToIso(editDate),
        });
        setEditingId(null);
        await refresh();
        onActivityChanged?.();
        toast.success('Update saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save update',
        );
      }
    });
  };

  if (!pipelineDealId && !commercialRequirementId) {
    return null;
  }

  const visibleNotes =
    activityOnly && !showAllNotes ? notes.slice(0, previewCount) : notes;
  const hiddenCount =
    activityOnly && !showAllNotes
      ? Math.max(0, notes.length - previewCount)
      : 0;

  return (
    <div
      className={
        activityOnly
          ? 'space-y-3'
          : 'mt-4 space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-4'
      }
    >
      {!activityOnly ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Tasks
            </h4>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--workspace-shell-text-muted)]" />
            ) : null}
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              No open tasks yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1.5 text-xs text-[var(--workspace-shell-text)]"
                >
                  <span className="font-medium">{task.title}</span>
                  {task.dueDate ? (
                    <span className="ml-2 text-[var(--workspace-shell-text-muted)]">
                      due {task.dueDate}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Follow up…"
              className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTask();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !taskTitle.trim()}
              onClick={addTask}
              className="shrink-0 border-[color:var(--workspace-shell-border)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Activity
          </h4>
          {loading && activityOnly ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--workspace-shell-text-muted)]" />
          ) : null}
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No updates yet
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-[color:var(--workspace-shell-border)] pl-3">
            {visibleNotes.map((note) => (
              <li key={note.id} className="relative pb-3 last:pb-0">
                <span
                  className="absolute top-1.5 -left-[0.97rem] h-2 w-2 rounded-full bg-[var(--ozer-accent)]"
                  aria-hidden
                />
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      rows={2}
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(event) => setEditDate(event.target.value)}
                        className="h-8 w-[9.5rem] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs"
                      />
                      <Select
                        value={editAssignee}
                        onValueChange={setEditAssignee}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 w-[min(100%,12rem)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs">
                          <SelectValue placeholder="Assignee…" />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="__none__">No assignee</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !editBody.trim()}
                        onClick={saveEdit}
                        className="h-8"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                        className="h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                      <time dateTime={note.createdAt}>
                        {formatTimelineDate(note.createdAt)}
                      </time>
                      {note.createdBy ? (
                        <span className="font-medium text-[var(--workspace-shell-text)]">
                          {note.createdBy.name}
                        </span>
                      ) : null}
                      {note.assignedTo ? (
                        <span>→ {note.assignedTo.name}</span>
                      ) : null}
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                        onClick={() => startEdit(note)}
                        aria-label="Edit update"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                      {note.content}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
            onClick={() => setShowAllNotes(true)}
          >
            View all ({notes.length})
          </button>
        ) : null}
        {activityOnly && showAllNotes && notes.length > previewCount ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:underline"
            onClick={() => setShowAllNotes(false)}
          >
            Show less
          </button>
        ) : null}

        {activityOnly && !composerOpen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setComposerOpen(true)}
            className="border-[color:var(--workspace-shell-border)]"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add update
          </Button>
        ) : (
          <>
            <Textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={2}
              placeholder="What happened / what’s next…"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={noteDate}
                onChange={(event) => setNoteDate(event.target.value)}
                className="h-8 w-[9.5rem] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs"
                aria-label="Update date"
              />
              <Select
                value={assignedToUserId}
                onValueChange={setAssignedToUserId}
                disabled={pending}
              >
                <SelectTrigger className="h-8 w-[min(100%,14rem)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs">
                  <SelectValue placeholder="Assign next chase…" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="__none__">No assignee</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !noteBody.trim()}
                onClick={addNote}
                className="border-[color:var(--workspace-shell-border)]"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Log update
              </Button>
              {activityOnly ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setComposerOpen(false);
                    setNoteBody('');
                  }}
                  className="h-8"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
