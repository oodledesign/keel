'use client';

import { useState } from 'react';

import { ChevronDown, LifeBuoy } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { PlatformSupportTicketDialog } from '~/components/workspace-shell/platform-support-ticket-dialog';

type WorkspaceHelpButtonProps = {
  className?: string;
  /** Pre-select workspace when opened from a team account shell. */
  defaultAccountId?: string | null;
  /** Inline with the mobile floating bottom bar, or fixed FAB (desktop). */
  variant?: 'inline' | 'fixed';
};

const triggerBaseClass =
  'flex items-center justify-center rounded-full border border-[var(--workspace-shell-border)] text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]';

export function WorkspaceHelpButton({
  className,
  defaultAccountId = null,
  variant = 'fixed',
}: WorkspaceHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          triggerBaseClass,
          open &&
            'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]',
          variant === 'inline'
            ? 'h-12 w-12 bg-[var(--workspace-shell-panel)]/98 shadow-[0_4px_16px_rgba(42,23,32,0.12),0_8px_28px_rgba(42,23,32,0.1)] backdrop-blur-xl'
            : 'fixed right-4 bottom-6 z-[65] hidden h-11 w-11 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)] lg:flex',
          className,
        )}
        aria-label={open ? 'Close help and support' : 'Help and feedback'}
        aria-expanded={open}
        title="Help and feedback"
      >
        {open ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <LifeBuoy className="h-5 w-5" />
        )}
      </button>

      <PlatformSupportTicketDialog
        open={open}
        onOpenChange={setOpen}
        defaultAccountId={defaultAccountId}
      />
    </>
  );
}
