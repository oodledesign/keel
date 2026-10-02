'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  CheckSquare,
  Clock,
  ExternalLink,
  FolderKanban,
  Layers,
  Loader2,
  RefreshCw,
  StickyNote,
  UserCheck,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { listProjectAuditLogAction } from '~/lib/projects/project-audit-actions';
import type {
  ProjectAuditEntityType,
  ProjectAuditEvent,
} from '~/lib/projects/project-audit.service';

const ENTITY_FILTERS: Array<{
  key: 'all' | ProjectAuditEntityType;
  label: string;
}> = [
  { key: 'all', label: 'All' },
  { key: 'task', label: 'Tasks' },
  { key: 'phase', label: 'Phases' },
  { key: 'note', label: 'Notes' },
  { key: 'guest', label: 'Guests' },
  { key: 'project', label: 'Project' },
];

function entityIcon(type: ProjectAuditEntityType) {
  switch (type) {
    case 'task':
      return <CheckSquare className="h-4 w-4 text-sky-500" />;
    case 'phase':
      return <Layers className="h-4 w-4 text-purple-500" />;
    case 'note':
      return <StickyNote className="h-4 w-4 text-amber-500" />;
    case 'guest':
      return <UserCheck className="h-4 w-4 text-[var(--ozer-accent)]" />;
    case 'project':
      return <FolderKanban className="h-4 w-4 text-emerald-500" />;
  }
}

function roleBadgeClass(role: string, isGuest: boolean) {
  if (isGuest || role === 'Guest') {
    return 'bg-[var(--ozer-accent)]/15 text-[var(--ozer-accent)] border-[var(--ozer-accent)]/30';
  }
  if (role === 'Owner') {
    return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
  }
  if (role === 'Admin') {
    return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
  }
  return 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] border-transparent';
}

function relativeWhen(iso: string) {
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const deltaSec = Math.round((Date.now() - then) / 1000);
    if (deltaSec < 60) return 'just now';
    if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
    if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
    if (deltaSec < 86400 * 7) return `${Math.floor(deltaSec / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function formatFullDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function renderDiff(changes: Record<string, unknown>) {
  if (!changes || Object.keys(changes).length === 0) return null;

  const diffItems: Array<{ field: string; text: string }> = [];

  for (const [field, val] of Object.entries(changes)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const v = val as { old?: unknown; new?: unknown; updated?: boolean };
      if (v.old !== undefined && v.new !== undefined) {
        diffItems.push({
          field,
          text: `${String(v.old ?? 'none')} → ${String(v.new ?? 'none')}`,
        });
      } else if (v.updated) {
        diffItems.push({ field, text: 'updated' });
      } else if (v.new !== undefined) {
        diffItems.push({ field, text: String(v.new) });
      }
    }
  }

  if (diffItems.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {diffItems.map(({ field, text }) => (
        <span
          key={field}
          className="inline-flex items-center gap-1 rounded border border-[color:var(--workspace-shell-border)]/50 bg-[var(--workspace-control-surface)] px-1.5 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]"
        >
          <span className="font-semibold text-[var(--workspace-shell-text)]">
            {field}:
          </span>{' '}
          <span className="max-w-[200px] truncate">{text}</span>
        </span>
      ))}
    </div>
  );
}

export function ProjectAuditFeed({
  accountId,
  accountSlug,
  projectId,
  initialEvents,
  showProjectLink = false,
}: {
  accountId: string;
  accountSlug: string;
  projectId?: string;
  initialEvents?: ProjectAuditEvent[];
  showProjectLink?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | ProjectAuditEntityType>('all');
  const [events, setEvents] = useState<ProjectAuditEvent[]>(
    initialEvents ?? [],
  );
  const [hasMore, setHasMore] = useState((initialEvents?.length ?? 0) >= 40);
  const [loading, setLoading] = useState(initialEvents === undefined);
  const [pending, startTransition] = useTransition();

  const loadEvents = useCallback(
    async (entityType?: ProjectAuditEntityType, offset = 0) => {
      try {
        const result = await listProjectAuditLogAction({
          accountId,
          projectId,
          entityType,
          limit: 40,
          offset,
        });
        if (offset === 0) {
          setEvents(result);
        } else {
          setEvents((prev) => [...prev, ...result]);
        }
        setHasMore(result.length >= 40);
      } catch {
        // keep current events
      } finally {
        setLoading(false);
      }
    },
    [accountId, projectId],
  );

  useEffect(() => {
    if (initialEvents === undefined) {
      void loadEvents(undefined, 0);
    }
  }, [initialEvents, loadEvents]);

  const handleFilterChange = (nextFilter: 'all' | ProjectAuditEntityType) => {
    setFilter(nextFilter);
    setLoading(true);
    startTransition(() => {
      void loadEvents(nextFilter === 'all' ? undefined : nextFilter, 0);
    });
  };

  const handleLoadMore = () => {
    startTransition(() => {
      void loadEvents(filter === 'all' ? undefined : filter, events.length);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {ENTITY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterChange(key)}
              aria-pressed={filter === key}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === key
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || pending}
          onClick={() => {
            setLoading(true);
            void loadEvents(filter === 'all' ? undefined : filter, 0);
          }}
          className="h-8 text-xs text-[var(--workspace-shell-text-muted)]"
        >
          <RefreshCw
            className={cn(
              'mr-1.5 h-3.5 w-3.5',
              (loading || pending) && 'animate-spin',
            )}
          />
          Refresh
        </Button>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-[var(--workspace-shell-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading activity log…
        </div>
      ) : events.length === 0 ? (
        <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <CardContent className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No activity recorded yet for this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {events.map((event) => {
            const actorName = event.actor?.name || 'System';
            const initials = actorName.slice(0, 2).toUpperCase();
            const projectUrl = pathsConfig.app.accountJobDetail
              .replace('[account]', accountSlug)
              .replace('[id]', event.projectId);

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-[color:var(--workspace-shell-border)]/70 bg-[var(--workspace-shell-panel)] p-3 text-sm transition-colors hover:border-[color:var(--workspace-shell-border)]"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)]/60 bg-[var(--workspace-control-surface)]">
                  {entityIcon(event.entityType)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {event.summary}
                    </p>
                    {showProjectLink && event.projectName ? (
                      <Link
                        href={projectUrl}
                        className="inline-flex items-center gap-1 text-xs text-[var(--workspace-shell-accent-text)] hover:underline"
                      >
                        {event.projectName}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    ) : null}
                  </div>

                  {renderDiff(event.changes)}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-4 w-4">
                        {event.actor?.pictureUrl ? (
                          <AvatarImage
                            src={event.actor.pictureUrl}
                            alt={actorName}
                          />
                        ) : null}
                        <AvatarFallback className="text-[9px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-[var(--workspace-shell-text)]">
                        {actorName}
                      </span>
                      {event.actor ? (
                        <span
                          className={cn(
                            'py-0.2 rounded border px-1 text-[10px] font-semibold',
                            roleBadgeClass(
                              event.actor.roleLabel,
                              event.actor.isGuest,
                            ),
                          )}
                        >
                          {event.actor.roleLabel}
                        </span>
                      ) : null}
                    </div>
                    <span>·</span>
                    <span title={formatFullDate(event.createdAt)}>
                      {relativeWhen(event.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore ? (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={handleLoadMore}
                className="text-xs"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
