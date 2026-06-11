'use client';

import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';

type Props = {
  shortcuts: ResolvedShortcut[];
  settingsHref?: string;
  className?: string;
};

export function DashboardShortcutsBar({
  shortcuts,
  settingsHref,
  className,
}: Props) {
  if (shortcuts.length === 0 && !settingsHref) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Shortcuts
        </p>
        {settingsHref ? (
          <Link
            href={settingsHref}
            className="text-xs font-medium text-[#5eead4] hover:text-[#34b3a4]"
          >
            Manage
          </Link>
        ) : null}
      </div>

      {shortcuts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.id}
              href={shortcut.href}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm font-medium text-white transition-colors hover:border-[var(--keel-teal)]/40 hover:bg-white/[0.03]"
              title={shortcut.description}
            >
              <span className="truncate">{shortcut.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-[#5eead4]" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No shortcuts yet.{' '}
          {settingsHref ? (
            <Link href={settingsHref} className="text-[#5eead4] hover:underline">
              Add some in settings
            </Link>
          ) : null}
        </p>
      )}
    </div>
  );
}
