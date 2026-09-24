'use client';

import { useCallback, useRef } from 'react';

import { Checkbox } from '@kit/ui/checkbox';

import { statusAfterDoneToggle } from '~/lib/projects/task-status-badge';

export function useTaskDoneStatusToggle() {
  const remembered = useRef(new Map<string, string>());

  return useCallback((taskId: string, currentStatus: string, done: boolean) => {
    const previousRemember = remembered.current.get(taskId) ?? null;
    const next = statusAfterDoneToggle(currentStatus, done, previousRemember);

    if (next.remember) remembered.current.set(taskId, next.remember);
    else remembered.current.delete(taskId);

    return {
      status: next.status,
      rollback() {
        if (previousRemember) remembered.current.set(taskId, previousRemember);
        else remembered.current.delete(taskId);
      },
    };
  }, []);
}

export function ProjectTaskDoneCheckbox({
  checked,
  disabled,
  title,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled || !onCheckedChange}
      data-task-row-action=""
      data-test="project-task-done-checkbox"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onCheckedChange={(value) => {
        if (value === 'indeterminate' || !onCheckedChange) return;
        onCheckedChange(Boolean(value));
      }}
      aria-label={checked ? `Mark “${title}” not done` : `Mark “${title}” done`}
      className="h-4 w-4 shrink-0 rounded-full border-[color:var(--workspace-shell-border)] shadow-none data-[state=checked]:border-[var(--ozer-accent)] data-[state=checked]:bg-[var(--ozer-accent-subtle)] data-[state=checked]:text-[var(--ozer-accent)]"
    />
  );
}
