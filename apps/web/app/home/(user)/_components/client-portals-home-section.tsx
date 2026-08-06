import Link from 'next/link';

import pathsConfig from '~/config/paths.config';

import type { UserClientPortalMembership } from '../_lib/server/list-user-client-portal-memberships';

export function ClientPortalsHomeSection(props: {
  portals: UserClientPortalMembership[];
}) {
  if (props.portals.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Client portals
      </h2>
      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
        Portals you have contact access to.
      </p>
      <ul className="mt-3 space-y-2">
        {props.portals.map((portal) => (
          <li key={portal.clientOrgId}>
            <Link
              href={pathsConfig.app.clientPortalHome.replace(
                '[clientSlug]',
                portal.slug,
              )}
              className="flex items-center justify-between rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text)] transition hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <span className="truncate font-medium">{portal.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
