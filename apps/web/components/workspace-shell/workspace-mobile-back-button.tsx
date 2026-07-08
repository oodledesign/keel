'use client';

import { useRouter } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { HapticButton } from '~/components/haptic-link';

type WorkspaceMobileBackButtonProps = {
  className?: string;
};

const triggerBaseClass =
  'flex h-12 w-12 items-center justify-center rounded-full border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/98 text-[var(--workspace-shell-text-muted)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)] hover:text-[var(--ozer-accent)]';

/**
 * Floating back control for the mobile PWA chrome — mirrors the help FAB on the right.
 */
export function WorkspaceMobileBackButton({
  className,
}: WorkspaceMobileBackButtonProps) {
  const router = useRouter();

  return (
    <HapticButton
      type="button"
      onClick={() => router.back()}
      className={cn(triggerBaseClass, className)}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="h-5 w-5" />
    </HapticButton>
  );
}
