'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  createWipAttachmentNote,
  createWipAttachmentTask,
  listWipAttachmentNotes,
  listWipAttachmentTasks,
  type WipAttachmentNote,
  type WipAttachmentTask,
} from '../_lib/server/wip-attachments.actions';

type Props = {
  accountId: string;
  accountSlug?: string | null;
  pipelineDealId?: string | null;
  commercialRequirementId?: string | null;
};

export function WipAttachmentsStrip({
  accountId,
  accountSlug,
  pipelineDealId,
  commercialRequirementId,
}: Props) {
  const [tasks, setTasks] = useState<WipAttachmentTask[]>([]);
  const [notes, setNotes] = useState<WipAttachmentNote[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
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
      const [nextTasks, nextNotes] = await Promise.all([
        listWipAttachmentTasks(scope),
        listWipAttachmentNotes(scope),
      ]);
      setTasks(nextTasks);
      setNotes(nextNotes);
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
        });
        setNoteBody('');
        await refresh();
        toast.success('Note added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add note',
        );
      }
    });
  };

  if (!pipelineDealId && !commercialRequirementId) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-4">
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

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Notes
        </h4>
        {notes.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No notes yet — capture what’s happened / what’s next.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1.5 text-xs text-[var(--workspace-shell-text)]"
              >
                <p className="line-clamp-3 whitespace-pre-wrap">
                  {note.content}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={noteBody}
          onChange={(event) => setNoteBody(event.target.value)}
          rows={2}
          placeholder="What’s happened…"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !noteBody.trim()}
          onClick={addNote}
          className="border-[color:var(--workspace-shell-border)]"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add note
        </Button>
      </section>
    </div>
  );
}
