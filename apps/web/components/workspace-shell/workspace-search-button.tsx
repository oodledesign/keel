'use client';

import { Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { useQuickAction } from '~/components/quick-action/quick-action-provider';

export function WorkspaceSearchButton(props: {
  className?: string;
  /** Icon-only control for the dense top bar. */
  iconOnly?: boolean;
}) {
  const { setOpen } = useQuickAction();
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  if (props.iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Search (${shortcutLabel})`}
            className={cn(
              'h-8 w-8 rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
              props.className,
            )}
            onClick={() => setOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Search
          <span className="ml-1.5 text-[var(--workspace-shell-text-muted)]">
            {shortcutLabel}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'hidden h-8 gap-1.5 rounded-md border border-[color:var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-2.5 text-xs font-medium text-[var(--workspace-shell-text)] shadow-none hover:border-[color:var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)] hover:text-[var(--workspace-shell-text)] sm:inline-flex',
        props.className,
      )}
      onClick={() => setOpen(true)}
    >
      <Search className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
      <span>Search</span>
      <kbd className="pointer-events-none hidden rounded border border-[color:var(--ozer-accent)]/20 bg-[var(--workspace-shell-panel)] px-1 py-0.5 text-[9px] font-medium text-[var(--workspace-shell-text)]/55 lg:inline">
        {shortcutLabel}
      </kbd>
    </Button>
  );
}
