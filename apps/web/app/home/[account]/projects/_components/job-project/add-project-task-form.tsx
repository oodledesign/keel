'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';

export function AddProjectTaskForm({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (title: string, subtaskTitles: string[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [subtaskTitles, setSubtaskTitles] = useState<string[]>([]);

  const reset = () => {
    setTitle('');
    setSubtaskTitles([]);
  };

  const submit = () => {
    const nextTitle = title.trim();
    if (!nextTitle || disabled) return;
    onSubmit(
      nextTitle,
      subtaskTitles.map((item) => item.trim()).filter(Boolean),
    );
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
      <div className="flex gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add task…"
          className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
          disabled={disabled}
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

      {subtaskTitles.map((subtaskTitle, index) => (
        <Input
          key={`subtask-${index}`}
          value={subtaskTitle}
          onChange={(e) => {
            const next = [...subtaskTitles];
            next[index] = e.target.value;
            setSubtaskTitles(next);
          }}
          placeholder={`Subtask ${index + 1}`}
          className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] pl-6 text-sm text-[var(--workspace-shell-text)]"
          disabled={disabled}
        />
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setSubtaskTitles((prev) => [...prev, ''])}
        className="px-1 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
      >
        + Add subtask
      </button>
    </form>
  );
}
