'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';

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
} from '../_lib/server/wip-attachments.actions';

type Props = {
  accountId: string;
  accountSlug?: string | null;
  pipelineDealId?: string | null;
  commercialRequirementId?: string | null;
  /** Compact mode for ladder row expand (activity only). */
  activityOnly?: boolean;
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

export function WipAttachmentsStrip({
  accountId,
  accountSlug,
  pipelineDealId,
  commercialRequirementId,
  activityOnly = false,
  onActivityChanged,
}: Props) {
  const [tasks, setTasks] = useState<WipAttachmentTask[]>([]);
  const [notes, setNotes] = useState<WipAttachmentNote[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [taskTitle, setTaskTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<string>('__none__');
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

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
        });
        setNoteBody('');
        setAssignedToUserId('__none__');
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

  if (!pipelineDealId && !commercialRequirementId) {
    return null;
  }

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
            No updates yet — log what happened and what’s next.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-[color:var(--workspace-shell-border)] pl-3">
            {notes.map((note) => (
              <li key={note.id} className="relative pb-3 last:pb-0">
                <span
                  className="absolute top-1.5 -left-[0.97rem] h-2 w-2 rounded-full bg-[var(--ozer-accent)]"
                  aria-hidden
                />
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
                </div>
                <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                  {note.content}
                </p>
              </li>
            ))}
          </ol>
        )}
        <Textarea
          value={noteBody}
          onChange={(event) => setNoteBody(event.target.value)}
          rows={2}
          placeholder="What happened / what’s next…"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={assignedToUserId}
            onValueChange={setAssignedToUserId}
            disabled={pending}
          >
            <SelectTrigger className="h-8 w-[min(100%,14rem)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs">
              <SelectValue placeholder="Assign next chase…" />
            </SelectTrigger>
            <SelectContent>
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
        </div>
      </section>
    </div>
  );
}
