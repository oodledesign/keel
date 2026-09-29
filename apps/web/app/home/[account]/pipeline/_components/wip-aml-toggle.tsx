'use client';

import { Check } from 'lucide-react';

import { cn } from '@kit/ui/utils';

export function WipAmlToggle({
  done,
  doneAt,
  disabled = false,
  onToggle,
  className,
}: {
  done: boolean;
  doneAt?: string | null;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
}) {
  const doneLabel = doneAt
    ? `AML done ${new Date(doneAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })}`
    : 'AML done';

  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={done ? doneLabel : 'AML not done'}
      title={done ? doneLabel : 'AML not done'}
      disabled={disabled}
      data-test="wip-aml-toggle"
      data-aml-done={done ? 'true' : 'false'}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold tracking-wide transition-colors',
        done
          ? 'border-emerald-700/30 bg-emerald-600/15 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-400/15 dark:text-emerald-200'
          : 'border-amber-700/30 bg-amber-500/15 text-amber-900 dark:border-amber-200/30 dark:bg-amber-400/15 dark:text-amber-100',
        disabled ? 'cursor-wait opacity-60' : 'hover:brightness-95',
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (!disabled) onToggle(!done);
      }}
    >
      {done ? (
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.75} />
      ) : null}
      <span>AML</span>
    </button>
  );
}
