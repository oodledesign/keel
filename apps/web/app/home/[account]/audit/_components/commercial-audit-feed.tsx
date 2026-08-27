'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Building2, CircleDot, ScrollText, UserRound } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { CommercialAccountEvent } from '~/lib/commercial/account-events';

type EntityFilter = 'all' | 'listing' | 'client';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function relativeWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return formatWhen(iso);
  const deltaSec = Math.round((Date.now() - then) / 1000);
  if (deltaSec < 60) return 'just now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  if (deltaSec < 86400 * 7) return `${Math.floor(deltaSec / 86400)}d ago`;
  return formatWhen(iso);
}

function formatTimestampLabel(iso: string) {
  const relative = relativeWhen(iso);
  const clock = formatClock(iso);
  if (
    clock &&
    (relative === 'just now' || relative.endsWith(' ago'))
  ) {
    return `${relative} · ${clock}`;
  }
  return relative;
}

function entityHref(
  accountSlug: string,
  event: CommercialAccountEvent,
): string | null {
  if (event.entityType === 'listing') {
    if (event.eventType === 'listing_deleted') return null;
    return pathsConfig.app.accountListingDetail
      .replace('[account]', accountSlug)
      .replace('[id]', event.entityId);
  }
  if (event.entityType === 'client') {
    return pathsConfig.app.accountClientDetail
      .replace('[account]', accountSlug)
      .replace('[clientId]', event.entityId);
  }
  return null;
}

function EntityIcon({ entityType }: { entityType: string }) {
  if (entityType === 'client') {
    return <UserRound className="h-3.5 w-3.5" />;
  }
  if (entityType === 'listing') {
    return <Building2 className="h-3.5 w-3.5" />;
  }
  return <CircleDot className="h-3.5 w-3.5" />;
}

export function CommercialAuditFeed({
  accountSlug,
  events,
  members,
}: {
  accountSlug: string;
  events: CommercialAccountEvent[];
  members: Array<{ userId: string; name: string }>;
}) {
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (entityFilter !== 'all' && event.entityType !== entityFilter) {
        return false;
      }
      if (actorFilter !== 'all' && event.actorUserId !== actorFilter) {
        return false;
      }
      return true;
    });
  }, [events, entityFilter, actorFilter]);

  const chips: Array<{ key: EntityFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'listing', label: 'Disposals' },
    { key: 'client', label: 'Contacts' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setEntityFilter(chip.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                entityFilter === chip.key
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {members.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <span className="sr-only">Member</span>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2.5 py-1.5 text-sm text-[var(--workspace-shell-text)]"
            >
              <option value="all">All members</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-6 py-14 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-[var(--workspace-shell-text)]/25" />
          <p className="mt-3 font-medium text-[var(--workspace-shell-text)]">
            No audit events yet
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Changes to disposals and contacts will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {filtered.map((event) => {
              const href = entityHref(accountSlug, event);
              const initials = (event.actorName ?? '?')
                .split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <li key={event.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                    {event.actorPictureUrl ? (
                      <AvatarImage src={event.actorPictureUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-[var(--ozer-accent-subtle)] text-[10px] text-[var(--workspace-shell-accent-text)]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {event.summary}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      <span>{event.actorName ?? 'Someone'}</span>
                      <span className="text-[var(--workspace-shell-text)]/25">
                        ·
                      </span>
                      <span
                        className="inline-flex items-center gap-1"
                        title={event.entityType}
                      >
                        <EntityIcon entityType={event.entityType} />
                        {href && event.entityLabel ? (
                          <Link
                            href={href}
                            className="hover:text-[var(--workspace-shell-accent-text)] hover:underline"
                          >
                            {event.entityLabel}
                          </Link>
                        ) : (
                          <span>
                            {event.entityLabel ??
                              (event.entityType === 'listing'
                                ? 'Disposal'
                                : event.entityType === 'client'
                                  ? 'Contact'
                                  : event.entityType)}
                          </span>
                        )}
                      </span>
                      <span className="text-[var(--workspace-shell-text)]/25">
                        ·
                      </span>
                      <span title={formatWhen(event.createdAt)}>
                        {formatTimestampLabel(event.createdAt)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
