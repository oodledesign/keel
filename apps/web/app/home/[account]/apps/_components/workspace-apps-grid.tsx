import Link from 'next/link';

import type { NavChild } from '~/config/work-account-navigation.config';

export function WorkspaceAppsGrid(props: { apps: NavChild[] }) {
  if (props.apps.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-6 text-sm">
        No apps are enabled for this workspace yet. Ask an admin to turn on modules
        in settings.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {props.apps.map((app) => (
        <Link
          key={app.path}
          href={app.path}
          className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-5 transition-colors hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
              {app.Icon}
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
