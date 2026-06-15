'use client';

import { useState } from 'react';

import { LifeBuoy } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { PlatformSupportTicketDialog } from '~/components/workspace-shell/platform-support-ticket-dialog';

type WorkspaceHelpButtonProps = {
  className?: string;
  /** Pre-select workspace when opened from a team account shell. */
  defaultAccountId?: string | null;
};

export function WorkspaceHelpButton({
  className,
  defaultAccountId = null,
}: WorkspaceHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[35] flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[var(--workspace-shell-panel)] text-[var(--keel-teal)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:border-[var(--keel-teal)]/40 hover:bg-[var(--keel-teal)]/10 lg:bottom-6',
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
