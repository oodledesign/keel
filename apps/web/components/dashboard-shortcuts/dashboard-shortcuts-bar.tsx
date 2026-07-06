'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { ArrowUpRight, X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import { MobileNavTabIcon } from '~/components/workspace-shell/mobile-nav-tab-icon';
import { dismissNotice, isNoticeDismissed } from '~/lib/dismissible-notice';
import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';
import { coerceMobileNavIconKey } from '~/lib/mobile-nav/nav-icon-keys';

type Props = {
  shortcuts: ResolvedShortcut[];
  settingsHref?: string;
  className?: string;
  stripWorkspacePrefix?: string;
  compact?: boolean;
  dismissKey?: string;
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
  dismissKey = 'dashboard-shortcuts-empty',
}: Props) {
  const [emptyDismissed, setEmptyDismissed] = useState(false);

  useEffect(() => {
    setEmptyDismissed(isNoticeDismissed(dismissKey));
  }, [dismissKey]);

  if (shortcuts.length === 0 && !settingsHref) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          Shortcuts
        </p>
        {settingsHref ? (
          <HapticLink
            href={settingsHref}
            className="text-xs font-medium text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent)]"
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
                  'group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] font-medium text-[var(--workspace-shell-text)] shadow-sm transition-colors hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--ozer-accent-subtle)]',
                  compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                )}
                title={shortcut.description}
              >
                {shortcut.avatarFallback ? (
                  <Avatar className="h-5 w-5 shrink-0 rounded-md">
                    <AvatarImage src={shortcut.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback
                      className="rounded-md text-[9px] font-semibold text-[var(--workspace-shell-text)]"
                      style={{
                        backgroundColor: shortcut.avatarColor ?? '#64748B',
                      }}
                    >
                      {shortcut.avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <MobileNavTabIcon
                    iconKey={coerceMobileNavIconKey(shortcut.iconKey) ?? 'workspace'}
                    href={shortcut.href}
                    className="h-4 w-4 text-[var(--ozer-accent)]"
                  />
                )}
                <span className="truncate">{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)] group-hover:text-[var(--ozer-accent-muted)]" />
              </HapticLink>
            );
          })}
        </div>
      ) : emptyDismissed ? null : (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No shortcuts yet.{' '}
            {settingsHref ? (
              <Link href={settingsHref} className="text-[var(--ozer-accent-muted)] hover:underline">
                Add some in settings
              </Link>
            ) : null}
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-white/8 hover:text-[var(--workspace-shell-text)]"
            onClick={() => {
              dismissNotice(dismissKey, 14);
              setEmptyDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
