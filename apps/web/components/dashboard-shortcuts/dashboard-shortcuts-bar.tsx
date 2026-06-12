'use client';

import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';
import { HapticLink } from '~/components/haptic-link';

type Props = {
  shortcuts: ResolvedShortcut[];
  settingsHref?: string;
  className?: string;
  /** When set, strips "{name} — " prefix from shortcut labels (workspace home). */
  stripWorkspacePrefix?: string;
  compact?: boolean;
};

function stripPrefix(label: string, prefix: string) {
  const needle = `${prefix} — `;
  if (label.startsWith(needle)) {
    return label.slice(needle.length);
  }
  return label;
}

export function DashboardShortcutsBar({
  shortcuts,
  settingsHref,
  className,
  stripWorkspacePrefix,
  compact = false,
}: Props) {
  if (shortcuts.length === 0 && !settingsHref) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'font-medium uppercase tracking-wide text-zinc-500',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          Shortcuts
        </p>
        {settingsHref ? (
          <HapticLink
            href={settingsHref}
            className="text-xs font-medium text-[#5eead4] hover:text-[#34b3a4]"
          >
            Manage
          </HapticLink>
        ) : null}
      </div>

      {shortcuts.length > 0 ? (
        <div className={cn('flex gap-2', compact ? 'flex-wrap' : 'flex-wrap')}>
          {shortcuts.map((shortcut) => {
            const label = stripWorkspacePrefix
              ? stripPrefix(shortcut.label, stripWorkspacePrefix)
              : shortcut.label;

            return (
              <HapticLink
                key={shortcut.id}
                href={shortcut.href}
                className={cn(
                  'group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.10] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[var(--keel-teal)]/35 hover:bg-[var(--keel-teal)]/12',
                  compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                )}
                title={shortcut.description}
              >
                {shortcut.avatarFallback ? (
                  <Avatar className="h-5 w-5 shrink-0 rounded-md">
                    <AvatarImage src={shortcut.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback
                      className="rounded-md text-[9px] font-semibold text-white"
                      style={{
                        backgroundColor: shortcut.avatarColor ?? '#64748B',
                      }}
                    >
                      {shortcut.avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
                <span className="truncate">{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-[#5eead4]" />
              </HapticLink>
            );
          })}
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
