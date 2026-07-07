'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { updateTask } from '../../_lib/actions/task-actions';

export function InlineTaskTitle({
  taskId,
  title,
  isDone,
  onTitleChanged,
  isolatePointer,
  readOnly,
}: {
  taskId: string;
  title: string;
  isDone: boolean;
  onTitleChanged?: (taskId: string, title: string) => void;
  /** Stops dnd-kit drag sensors on this control (board cards). */
  isolatePointer?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const save = useCallback(() => {
    if (readOnly) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(title);
      return;
    }
    if (trimmed === title) return;
    const prev = title;
    onTitleChanged?.(taskId, trimmed);
    void (async () => {
      const result = await updateTask(taskId, { title: trimmed });
      if (!result.success) {
        onTitleChanged?.(taskId, prev);
      }
      router.refresh();
    })();
  }, [draft, onTitleChanged, readOnly, router, taskId, title]);

  const cancel = useCallback(() => {
    setDraft(title);
    setEditing(false);
  }, [title]);

  if (readOnly) {
    return (
      <p
        className={`truncate text-[13px] font-medium leading-snug ${
          isDone
            ? 'text-[var(--workspace-shell-text-muted)] line-through'
            : 'text-[var(--workspace-shell-text)]'
        }`}
      >
        {title}
      </p>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => isolatePointer && e.stopPropagation()}
        onClick={(e) => isolatePointer && e.stopPropagation()}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1 text-sm font-medium leading-snug text-[var(--workspace-shell-text)] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-white/25"
        aria-label="Task title"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      onPointerDown={(e) => isolatePointer && e.stopPropagation()}
      className={`w-full min-w-0 rounded-sm text-left text-sm font-medium leading-snug transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/30 ${
        isDone
          ? 'text-[var(--workspace-shell-text-muted)] line-through'
          : 'text-[var(--workspace-shell-text)]'
      }`}
      aria-label="Edit title"
    >
      {title}
    </button>
  );
}
