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
        'hidden h-8 gap-1.5 rounded-md border-[color:var(--workspace-shell-border)] bg-transparent px-2.5 text-xs font-medium text-[var(--workspace-shell-text)]/90 shadow-none hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] sm:inline-flex',
        props.className,
      )}
      onClick={() => setOpen(true)}
    >
      <Sparkles className="h-3.5 w-3.5 text-[var(--workspace-shell-text)]/70" />
      <span>Quick action</span>
      <kbd className="pointer-events-none hidden rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1 py-0.5 text-[9px] font-medium text-[var(--workspace-shell-text)]/55 lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
