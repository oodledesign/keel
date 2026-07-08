'use client';

import Link from 'next/link';

import { ArrowRight, Star } from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import type {
  ClientOverviewItem,
  ClientProjectHealth,
} from '../_lib/clients-overview.types';

const HEALTH_STYLES: Record<
  ClientProjectHealth,
  { label: string; dot: string; badge: string }
> = {
  on_track: {
    label: 'On Track',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300',
  },
  at_risk: {
    label: 'At Risk',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/15 text-amber-300',
  },
  behind: {
    label: 'Behind',
    dot: 'bg-rose-400',
    badge: 'bg-rose-500/15 text-rose-300',
  },
};

type ClientOverviewCardProps = {
  client: ClientOverviewItem;
  accountSlug: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
};

export function ClientOverviewCard({
  client,
  accountSlug,
  isFavorite,
  onToggleFavorite,
}: ClientOverviewCardProps) {
  const detailHref = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${client.id}`;
  const jobsHref = pathsConfig.app.accountJobs.replace('[account]', accountSlug);
  const remainingProjects = Math.max(0, client.projectCount - client.projects.length);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-sm transition hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel-hover)]">
      <div className="flex items-start gap-3">
        <Link href={detailHref} className="shrink-0">
          <ProfileAvatar
            displayName={client.displayName}
            pictureUrl={client.pictureUrl}
            className="mx-0 h-12 w-12 rounded-full"
            fallbackClassName="rounded-full bg-[var(--workspace-shell-panel-hover)] text-lg text-[var(--workspace-shell-text)]"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Link
              href={detailHref}
              className="truncate text-base font-semibold text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
            >
              {client.displayName}
            </Link>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite();
              }}
              className="shrink-0 rounded-md p-1 text-[var(--workspace-shell-text-muted)] transition hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-amber-300"
              aria-label={isFavorite ? 'Remove favourite' : 'Add favourite'}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  isFavorite && 'fill-amber-300 text-amber-300',
                )}
              />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">{client.tagline}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-[color:var(--workspace-shell-border)] py-4">
        <div>
          <dd className="text-xl font-semibold text-[var(--workspace-shell-text)]">{client.projectCount}</dd>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">Projects</dt>
        </div>
        <div>
          <dd className="text-xl font-semibold text-[var(--workspace-shell-text)]">{client.teamMemberCount}</dd>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">Team Members</dt>
        </div>
        <div>
          <dd className="text-xl font-semibold text-[var(--workspace-shell-text)]">{client.dueTaskCount}</dd>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">Due Tasks</dt>
        </div>
      </dl>

      <div className="mt-4 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-shell-text-muted)]">
          Projects
        </p>

        {client.projects.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">No active projects yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {client.projects.map((project) => {
              const health = HEALTH_STYLES[project.health];
              const projectHref = pathsConfig.app.accountJobDetail
                .replace('[account]', accountSlug)
                .replace('[id]', project.id);

              return (
                <li key={project.id}>
                  <Link href={projectHref} className="block rounded-lg hover:bg-[var(--workspace-shell-sidebar-accent)]">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', health.dot)}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--workspace-shell-text)]">
                        {project.title}
                      </span>
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">{project.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-[var(--ozer-info)]"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                        health.badge,
                      )}
                    >
                      {health.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {remainingProjects > 0 ? (
          <Link
            href={jobsHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ozer-info)] hover:text-[var(--ozer-accent-muted)]"
          >
            View all {client.projectCount} projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : client.projectCount > 0 ? (
          <Link
            href={jobsHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ozer-info)] hover:text-[var(--ozer-accent-muted)]"
          >
            View projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span />
        )}

        {client.teamMembers.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {client.teamMembers.map((member) => (
              <ProfileAvatar
                key={member.userId}
                className="mx-0 h-8 w-8 border-2 border-[var(--workspace-shell-panel)]"
                displayName={member.name ?? 'Member'}
                pictureUrl={member.pictureUrl}
              />
            ))}
            {client.teamMemberCount > client.teamMembers.length ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--workspace-shell-panel)] bg-[var(--workspace-shell-panel-hover)] text-xs font-medium text-[var(--workspace-shell-text)]">
                +{client.teamMemberCount - client.teamMembers.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
