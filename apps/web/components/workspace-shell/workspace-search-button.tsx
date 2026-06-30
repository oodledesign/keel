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
        'hidden h-10 gap-2 rounded-lg border-[color:var(--workspace-shell-border)] bg-transparent px-3 text-sm font-medium text-[var(--workspace-shell-text)]/90 shadow-none hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] sm:inline-flex',
        props.className,
      )}
      onClick={() => setOpen(true)}
    >
      <Sparkles className="h-4 w-4 text-[var(--workspace-shell-text)]/70" />
      <span>Quick action</span>
      <kbd className="pointer-events-none hidden rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/55 lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
