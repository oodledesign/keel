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

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
] as const;

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

function avatarColorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function clientInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

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
  const avatarColor = avatarColorForId(client.id);
  const remainingProjects = Math.max(0, client.projectCount - client.projects.length);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)] p-5 shadow-sm transition hover:border-white/[0.14] hover:bg-[var(--workspace-shell-panel-hover)]">
      <div className="flex items-start gap-3">
        <Link
          href={detailHref}
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white',
            avatarColor,
          )}
        >
          {clientInitial(client.displayName)}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Link
              href={detailHref}
              className="truncate text-base font-semibold text-white hover:text-[#5eead4]"
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
              className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-amber-300"
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
          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{client.tagline}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-white/[0.06] py-4">
        <div>
          <dd className="text-xl font-semibold text-white">{client.projectCount}</dd>
          <dt className="text-xs text-zinc-500">Projects</dt>
        </div>
        <div>
          <dd className="text-xl font-semibold text-white">{client.teamMemberCount}</dd>
          <dt className="text-xs text-zinc-500">Team Members</dt>
        </div>
        <div>
          <dd className="text-xl font-semibold text-white">{client.dueTaskCount}</dd>
          <dt className="text-xs text-zinc-500">Due Tasks</dt>
        </div>
      </dl>

      <div className="mt-4 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Projects
        </p>

        {client.projects.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No active projects yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {client.projects.map((project) => {
              const health = HEALTH_STYLES[project.health];
              const projectHref = pathsConfig.app.accountJobDetail
                .replace('[account]', accountSlug)
                .replace('[id]', project.id);

              return (
                <li key={project.id}>
                  <Link href={projectHref} className="block rounded-lg hover:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', health.dot)}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                        {project.title}
                      </span>
                      <span className="text-xs text-zinc-500">{project.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-[var(--keel-accent-blue)]"
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
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--keel-accent-blue)] hover:text-[#5eead4]"
          >
            View all {client.projectCount} projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : client.projectCount > 0 ? (
          <Link
            href={jobsHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--keel-accent-blue)] hover:text-[#5eead4]"
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
                className="h-8 w-8 border-2 border-[var(--workspace-shell-panel)]"
                displayName={member.name ?? 'Member'}
                pictureUrl={member.pictureUrl}
              />
            ))}
            {client.teamMemberCount > client.teamMembers.length ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--workspace-shell-panel)] bg-zinc-700 text-xs font-medium text-zinc-200">
                +{client.teamMemberCount - client.teamMembers.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
