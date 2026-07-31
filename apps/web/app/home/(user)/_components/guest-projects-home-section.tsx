import Link from 'next/link';

import pathsConfig from '~/config/paths.config';
import type { ProjectGuest } from '~/lib/projects/project-guests.types';

export function GuestProjectsHomeSection(props: { guests: ProjectGuest[] }) {
  if (props.guests.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Shared projects
      </h2>
      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
        Guest access — task board only.
      </p>
      <ul className="mt-3 space-y-2">
        {props.guests.map((guest) => (
          <li key={guest.id}>
            <Link
              href={pathsConfig.app.personalGuestProject.replace(
                '[projectId]',
                guest.projectId,
              )}
              className="flex items-center justify-between rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text)] transition hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <span className="truncate font-medium">
                {guest.projectName ?? 'Project'}
              </span>
              <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                {guest.accountName ?? 'Workspace'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
