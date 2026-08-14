'use client';

import { ChevronDown, LifeBuoy } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { usePlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger-context';

type WorkspaceHelpButtonProps = {
  className?: string;
  /** Pre-select workspace when opened from a team account shell. */
  defaultAccountId?: string | null;
  /** Inline with the mobile floating bottom bar, or fixed FAB (desktop). */
  variant?: 'inline' | 'fixed';
};

export function WorkspaceHelpButton({
  className,
  defaultAccountId = null,
  variant = 'fixed',
}: WorkspaceHelpButtonProps) {
  const messenger = usePlatformSupportMessenger();
  const open = messenger?.open ?? false;

  return (
    <button
      type="button"
      data-tour="support-help"
      onClick={() => {
        if (!messenger) return;
        if (open) {
          messenger.setOpen(false);
          return;
        }
        messenger.openMessenger({
          view: 'home',
          accountId: defaultAccountId,
        });
      }}
      className={cn(
        'flex items-center justify-center rounded-full border transition-colors',
        variant === 'inline'
          ? 'h-12 w-12 shadow-[0_4px_16px_rgba(42,23,32,0.12),0_8px_28px_rgba(42,23,32,0.1)] backdrop-blur-xl'
          : 'fixed right-4 bottom-6 z-[65] hidden h-11 w-11 shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)] lg:flex',
        open
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:border-[var(--ozer-accent-hover)] hover:bg-[var(--ozer-accent-hover)]'
          : cn(
              'border-[var(--workspace-shell-border)] text-[var(--ozer-accent)] hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]',
              variant === 'inline'
                ? 'bg-[var(--workspace-shell-panel)]/98'
                : 'bg-[var(--workspace-shell-panel)]',
            ),
        className,
      )}
      aria-label={open ? 'Close help and support' : 'Help and support'}
      aria-expanded={open}
      title="Help and support"
    >
      {open ? (
        <ChevronDown className="h-5 w-5" />
      ) : (
        <LifeBuoy className="h-5 w-5" />
      )}
    </button>
  );
}
