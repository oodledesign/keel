'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ChevronDown, Coins, Layers, LifeBuoy, Plus } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

export function PortalSupportFab({ clientSlug }: { clientSlug: string }) {
  const [open, setOpen] = useState(false);

  const servicesHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const newHref = pathsConfig.app.clientPortalSupportNew.replace(
    '[clientSlug]',
    clientSlug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  return (
    <div className="fixed right-4 bottom-6 z-[65] flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_16px_48px_rgba(53,30,40,0.18)]">
          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Need help?
            </p>
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              Raise a request or check your services.
            </p>
          </div>
          <div className="space-y-0.5 p-1.5">
            <Link
              href={newHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
                <Plus className="h-4 w-4" />
              </span>
              New request
            </Link>
            <Link
              href={servicesHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
                <Layers className="h-4 w-4" />
              </span>
              View services
            </Link>
            <Link
              href={creditsHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
                <Coins className="h-4 w-4" />
              </span>
              Credits
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)] transition-colors',
          open
            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:border-[var(--ozer-accent-hover)] hover:bg-[var(--ozer-accent-hover)]'
            : 'border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--ozer-accent)] hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]',
        )}
        aria-label={open ? 'Close support' : 'Open support'}
        aria-expanded={open}
        title="Support"
      >
        {open ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <LifeBuoy className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
