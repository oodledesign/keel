'use client';

import Link from 'next/link';

import { LifeBuoy } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { cn } from '@kit/ui/utils';

type WorkspaceHelpButtonProps = {
  className?: string;
};

export function WorkspaceHelpButton({ className }: WorkspaceHelpButtonProps) {
  return (
    <Link
      href={`${pathsConfig.app.personalPlatformSupport}?new=1`}
      className={cn(
        'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[35] flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[var(--workspace-shell-panel)] text-[var(--keel-teal)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:border-[var(--keel-teal)]/40 hover:bg-[var(--keel-teal)]/10 lg:bottom-6',
        className,
      )}
      aria-label="Help and feedback"
      title="Help and feedback"
    >
      <LifeBuoy className="h-5 w-5" />
    </Link>
  );
}
