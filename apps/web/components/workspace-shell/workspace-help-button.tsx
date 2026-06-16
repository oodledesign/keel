'use client';

import { useState } from 'react';

import { LifeBuoy } from 'lucide-react';

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
  'flex items-center justify-center rounded-full border border-white/10 text-[var(--keel-teal)] transition-colors hover:border-[var(--keel-teal)]/40 hover:bg-[var(--keel-teal)]/10';

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
        onClick={() => setOpen(true)}
        className={cn(
          triggerBaseClass,
          variant === 'inline'
            ? 'h-12 w-12 bg-[#1A2535]/98 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl'
            : 'fixed bottom-6 right-4 z-[35] hidden h-11 w-11 border-white/12 bg-[var(--workspace-shell-panel)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] lg:flex',
          className,
        )}
        aria-label="Help and feedback"
        title="Help and feedback"
      >
        <LifeBuoy className="h-5 w-5" />
      </button>

      <PlatformSupportTicketDialog
        open={open}
        onOpenChange={setOpen}
        defaultAccountId={defaultAccountId}
      />
    </>
  );
}
