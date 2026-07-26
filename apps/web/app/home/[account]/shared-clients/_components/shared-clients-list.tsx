'use client';

import Link from 'next/link';

import { Building2, Share2 } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import type { ClientWorkspaceShare } from '~/lib/clients/client-workspace-shares.service';

const MODULE_LABELS: Array<{
  key: keyof ClientWorkspaceShare['capabilities'];
  label: string;
}> = [
  { key: 'canSupport', label: 'Support' },
  { key: 'canContacts', label: 'Contacts' },
  { key: 'canProjects', label: 'Projects' },
  { key: 'canDocs', label: 'Docs' },
  { key: 'canFinance', label: 'Finance' },
  { key: 'canPortal', label: 'Portal' },
];

export function SharedClientsList({
  accountSlug,
  shares,
}: {
  accountSlug: string;
  shares: ClientWorkspaceShare[];
}) {
  if (shares.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-6 py-12 text-center">
        <Share2 className="mx-auto mb-3 h-10 w-10 text-[var(--workspace-shell-text-muted)]" />
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No clients have been shared with this workspace yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      {shares.map((share) => {
        const name =
          share.clientDisplayName ?? share.clientOrgName ?? 'Shared client';
        const modules = MODULE_LABELS.filter(
          (module) => share.capabilities[module.key],
        );
        const href = pathsConfig.app.accountSharedClientDetail
          .replace('[account]', accountSlug)
          .replace('[shareId]', share.id);

        return (
          <li key={share.id}>
            <Link
              href={href}
              className="flex items-start gap-3 px-4 py-4 transition hover:bg-[var(--workspace-shell-panel-hover)]"
            >
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {name}
                </p>
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  From {share.ownerAccountName ?? 'partner workspace'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modules.map((module) => (
                    <span
                      key={module.key}
                      className="rounded-full border border-[color:var(--workspace-shell-border)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]"
                    >
                      {module.label}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
