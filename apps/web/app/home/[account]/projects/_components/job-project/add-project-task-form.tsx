'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';

import { TaskDurationFields } from '~/components/task-duration-fields';

export type AddProjectTaskDraft = {
  title: string;
  durationMinutes: number | null;
  subtasks: Array<{ title: string; durationMinutes: number | null }>;
};

export function AddProjectTaskForm({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (draft: AddProjectTaskDraft) => void;
}) {
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<
    Array<{ title: string; durationMinutes: number | null }>
  >([]);

  const reset = () => {
    setTitle('');
    setDurationMinutes(null);
    setSubtasks([]);
  };

  const submit = () => {
    const nextTitle = title.trim();
    if (!nextTitle || disabled) return;
    onSubmit({
      title: nextTitle,
      durationMinutes,
      subtasks: subtasks
        .map((item) => ({
          title: item.title.trim(),
          durationMinutes: item.durationMinutes,
        }))
        .filter((item) => item.title),
    });
    reset();
  };

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add task…"
          className="h-8 min-w-[10rem] flex-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
          disabled={disabled}
        />
        <TaskDurationFields
          value={durationMinutes}
          onChange={setDurationMinutes}
          disabled={disabled}
          idPrefix="project-add-duration"
          compact
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 px-2 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          disabled={!title.trim() || disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {subtasks.map((subtask, index) => (
        <div
          key={`subtask-${index}`}
          className="flex flex-wrap items-center gap-1"
        >
          <Input
            value={subtask.title}
            onChange={(e) => {
              const next = [...subtasks];
              const current = next[index];
              if (!current) return;
              next[index] = { ...current, title: e.target.value };
              setSubtasks(next);
            }}
            placeholder={`Subtask ${index + 1}`}
            className="h-8 min-w-[10rem] flex-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] pl-6 text-sm text-[var(--workspace-shell-text)]"
            disabled={disabled}
          />
          <TaskDurationFields
            value={subtask.durationMinutes}
            onChange={(nextDuration) => {
              const next = [...subtasks];
              const current = next[index];
              if (!current) return;
              next[index] = { ...current, durationMinutes: nextDuration };
              setSubtasks(next);
            }}
            disabled={disabled}
            idPrefix={`project-add-sub-duration-${index}`}
            compact
          />
        </div>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          setSubtasks((prev) => [...prev, { title: '', durationMinutes: null }])
        }
        className="px-1 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
      >
        + Add subtask
      </button>
    </form>
  );
}
