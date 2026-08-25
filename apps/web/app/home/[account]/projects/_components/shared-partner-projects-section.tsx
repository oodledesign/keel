'use client';

import Link from 'next/link';

import { FolderKanban, Share2 } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import type { PartnerBoardProject } from '~/lib/projects/partner-projects.loader';

function formatUpdated(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function SharedPartnerProjectsSection({
  accountSlug,
  projects,
}: {
  accountSlug: string;
  projects: PartnerBoardProject[];
}) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="shrink-0 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 px-4 py-3 md:px-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
          <h2 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Shared with you
          </h2>
        </div>
        <Link
          href={pathsConfig.app.accountSharedClients.replace(
            '[account]',
            accountSlug,
          )}
          className="text-[11px] text-[var(--ozer-accent)] hover:underline"
        >
          All shared clients
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const href = pathsConfig.app.accountSharedClientProject
            .replace('[account]', accountSlug)
            .replace('[shareId]', project.shareId)
            .replace('[projectId]', project.id);
          const clientHref = pathsConfig.app.accountSharedClientDetail
            .replace('[account]', accountSlug)
            .replace('[shareId]', project.shareId);

          return (
            <li key={`${project.shareId}:${project.id}`}>
              <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5 transition-colors hover:border-[var(--ozer-accent)]/40">
                <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="block truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent)]"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {project.clientName ?? 'Shared client'}
                    {project.ownerAccountName
                      ? ` · ${project.ownerAccountName}`
                      : ''}
                    {' · '}
                    {formatUpdated(project.updatedAt)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Link
                      href={href}
                      className="text-[11px] font-medium text-[var(--ozer-accent)] hover:underline"
                    >
                      Open board
                    </Link>
                    <Link
                      href={clientHref}
                      className="text-[11px] text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent)] hover:underline"
                    >
                      Shared client
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
