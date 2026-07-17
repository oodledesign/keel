'use client';

import { useEffect, useState } from 'react';

import { Calendar, ExternalLink, Loader2 } from 'lucide-react';

import { Checkbox } from '@kit/ui/checkbox';

import pathsConfig from '~/config/paths.config';
import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';

import type { PlanningMode } from './planner-types';

type Props = {
  mode: PlanningMode;
  date: string;
  initialStatus: { connected: boolean; configured: boolean };
  events: PlannerCalendarEvent[];
  onEventsChange: (events: PlannerCalendarEvent[]) => void;
  selectedEventIds: Set<string>;
  onSelectedEventIdsChange: (ids: Set<string>) => void;
};

function timeRange(event: PlannerCalendarEvent) {
  if (event.is_all_day) return 'All day';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fmt.format(new Date(event.start))}–${fmt.format(new Date(event.end))}`;
}

export function CalendarEventsSection({
  mode,
  date,
  initialStatus,
  events,
  onEventsChange,
  selectedEventIds,
  onSelectedEventIdsChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(initialStatus.connected);
  const [configured, setConfigured] = useState(initialStatus.configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ mode, date });

    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    }, 0);

    fetch(`/api/planner/calendar?${params}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          connected: boolean;
          configured: boolean;
          events: PlannerCalendarEvent[];
          error?: string;
        };
        if (!res.ok && body.error) {
          throw new Error(body.error);
        }
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setConnected(body.connected);
        setConfigured(body.configured);
        onEventsChange(body.events);
        onSelectedEventIdsChange(new Set(body.events.map((event) => event.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Could not load calendar',
        );
        onEventsChange([]);
        onSelectedEventIdsChange(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [date, mode, onEventsChange, onSelectedEventIdsChange]);

  function toggleEvent(id: string) {
    const next = new Set(selectedEventIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedEventIdsChange(next);
  }

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-bold text-[#4285F4]">
              G
            </span>
            Your calendar
          </h2>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            Events are treated as fixed blocks.
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--workspace-shell-text)]/45" />
        ) : null}
      </div>

      {!configured ? (
        <ConnectPrompt message="Add Google Calendar OAuth keys to enable sync." />
      ) : !connected ? (
        <ConnectPrompt message="Connect Google Calendar to include meetings." />
      ) : error ? (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
          {error}
        </p>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-[var(--workspace-shell-sidebar-accent)]"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-sm text-[var(--workspace-shell-text)]/55">
          No calendar events found for this {mode === 'day' ? 'day' : 'week'}.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <label
              key={event.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-sm"
            >
              <Checkbox
                checked={selectedEventIds.has(event.id)}
                onCheckedChange={() => toggleEvent(event.id)}
                className="mt-0.5 border-[color:var(--workspace-shell-border)]"
              />
              <span className="min-w-0">
                <span className="block font-mono text-xs text-sky-300/90">
                  {timeRange(event)}
                </span>
                <span className="block truncate text-[var(--workspace-shell-text)]">
                  {event.title}
                </span>
                <span className="block truncate text-xs text-[var(--workspace-shell-text)]/40">
                  {event.calendar}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function ConnectPrompt({ message }: { message: string }) {
  return (
    <a
      href={`/api/integrations/google-calendar/start?returnPath=${encodeURIComponent(
        pathsConfig.app.personalPlanner,
      )}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-sm text-[var(--workspace-shell-text)]/70 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
    >
      <span className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
        {message}
      </span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
