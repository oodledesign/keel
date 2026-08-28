import Link from 'next/link';

import { BadgeCheck } from 'lucide-react';

import type { NavChild } from '~/config/work-account-navigation.config';

const installedAppCardClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-5 shadow-[0_1px_2px_rgba(42,23,32,0.04)] transition-colors hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-panel-hover)]';

export function WorkspaceAppsGrid(props: { apps: NavChild[] }) {
  if (props.apps.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-6 text-sm">
        No apps are enabled for this workspace yet. Ask an admin to turn on
        modules in settings.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {props.apps.map((app) => (
        <Link key={app.path} href={app.path} className={installedAppCardClass}>
          <div className="flex items-start gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--ozer-accent)]">
              {app.Icon}
              <BadgeCheck
                className="absolute -right-1.5 -bottom-1.5 size-4 rounded-full bg-[var(--workspace-shell-panel)] fill-emerald-500 text-white dark:text-[var(--workspace-shell-panel)]"
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">{app.label}</h2>
              {app.description ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {app.description}
                </p>
              ) : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
