'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { useQuickAction } from '~/components/quick-action/quick-action-provider';

export function WorkspaceSearchButton(props: { className?: string }) {
  const { setOpen } = useQuickAction();

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
      <Sparkles className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
      <span>Quick action</span>
      <kbd className="pointer-events-none hidden rounded border border-[color:var(--ozer-accent)]/20 bg-[var(--workspace-shell-panel)] px-1 py-0.5 text-[9px] font-medium text-[var(--workspace-shell-text)]/55 lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
