'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

const SHORTCUTS = [
  { key: 'J / K', label: 'Next / previous thread' },
  { key: 'R', label: 'Reply now' },
  { key: 'L', label: 'Reply later' },
  { key: 'W', label: 'Waiting' },
  { key: 'F', label: 'FYI' },
  { key: 'N', label: 'Noise' },
] as const;

type Props = {
  className?: string;
  size?: 'sm' | 'md';
};

export function EmailReviewModeIndicator({ className, size = 'sm' }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'cursor-help rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] font-medium tracking-wide text-[var(--ozer-accent)] uppercase',
              size === 'sm'
                ? 'px-2 py-0.5 text-[10px]'
                : 'px-2.5 py-1 text-xs',
              className,
            )}
          >
            Review mode
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-[var(--workspace-shell-text)]"
        >
          <p className="text-xs font-medium">Keyboard shortcuts</p>
          <ul className="mt-2 space-y-1">
            {SHORTCUTS.map((shortcut) => (
              <li
                key={shortcut.key}
                className="flex gap-2 text-xs text-[var(--workspace-shell-text-muted)]"
              >
                <span className="shrink-0 font-mono text-[var(--workspace-shell-text)]">
                  {shortcut.key}
                </span>
                <span>{shortcut.label}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
