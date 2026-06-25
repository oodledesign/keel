'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Plus } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { createTask } from '../../_lib/actions/task-actions';

type InlineAddTaskRowProps = {
  priority: 'high' | 'medium';
  clientId?: string | null;
  workspaceAccountId?: string;
};

export function InlineAddTaskRow({
  priority,
  clientId,
  workspaceAccountId,
}: InlineAddTaskRowProps) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title: trimmed,
        priority,
        clientId: clientId ?? undefined,
        accountId: workspaceAccountId,
      });
      if (result.success) {
        setTitle('');
        setActive(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Could not create task');
      }
    });
  };

  return (
    <div
      className={cn(
        'border-t border-dashed border-white/10 bg-white/[0.03] px-4 py-3 transition-colors sm:px-5',
        active && 'bg-white/[0.05]',
      )}
    >
      {!active ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setActive(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-gradient-to-r from-[var(--keel-teal)]/6 to-[var(--keel-teal)]/3 px-4 py-3 text-sm font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/25 hover:from-[var(--keel-teal)]/10 hover:to-[var(--keel-teal)]/5 hover:text-white"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Add task
        </button>
      ) : (
        <div className="mx-auto max-w-2xl space-y-2">
          <input
            autoFocus
            value={title}
            disabled={isPending}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                setActive(false);
                setTitle('');
                setError(null);
              }
            }}
            onBlur={() => {
              if (!title.trim()) {
                setActive(false);
              }
            }}
            placeholder="Task name, press Enter to save"
            className="h-11 w-full rounded-xl border border-white/15 bg-[var(--workspace-shell-canvas)] px-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#2A9D8F]/50 focus:outline-none focus:ring-1 focus:ring-[#2A9D8F]/30"
            aria-label="New task title"
          />
          {error ? (
            <p className="text-xs text-rose-300/90">{error}</p>
          ) : needsAssignment ? (
            <p className="text-xs text-zinc-500">
              Link this task to a client or project with the Add Task button
              above, or filter by client first.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
