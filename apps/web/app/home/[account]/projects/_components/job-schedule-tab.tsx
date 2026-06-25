'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Calendar as CalendarIcon, MapPin, Pencil, Users } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type { CalendarEventClickPayload, CalendarItemNormalized } from '~/components/calendar/KeelCalendar';
import type { KeelCalendarView } from '~/components/calendar/KeelCalendar';

const KeelCalendar = dynamic(
  () => import('~/components/calendar/KeelCalendar').then((m) => m.KeelCalendar),
  { ssr: false, loading: () => <div className="flex h-[420px] items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] text-zinc-500">Loading calendar…</div> },
);

import pathsConfig from '~/config/paths.config';

import { getCalendarItemDetails, getJobCalendarItems, listAccountMembers, listJobEventAssignments } from '../_lib/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function JobScheduleTabContent({
  accountId,
  jobId,
  accountSlug,
  canEditJobs,
}: {
  accountId: string;
  jobId: string;
  accountSlug: string;
  canEditJobs: boolean;
}) {
  const [events, setEvents] = useState<CalendarItemNormalized[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState<KeelCalendarView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarItemNormalized | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [assignees, setAssignees] = useState<{ user_id: string; name: string | null; email: string | null; picture_url?: string | null }[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const fetchItems = useCallback(
    async (start: Date, end: Date) => {
      setLoading(true);
      try {
        const list = await getJobCalendarItems({
          accountId,
          jobId,
          start: start.toISOString(),
          end: end.toISOString(),
        });
        setEvents((list ?? []) as CalendarItemNormalized[]);
      } catch (err) {
        toast.error(getErrorMessage(err));
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [accountId, jobId],
  );

  useEffect(() => {
    if (!dateRange) return;
    fetchItems(dateRange.start, dateRange.end);
  }, [dateRange, fetchItems]);

  const handleDatesSet = useCallback((range: { start: Date; end: Date }) => {
    setDateRange((prev) =>
      prev && prev.start.getTime() === range.start.getTime() && prev.end.getTime() === range.end.getTime()
        ? prev
        : range,
    );
  }, []);

  const handleEventClick = useCallback(
    async (event: CalendarEventClickPayload) => {
      setSelectedEvent(event);
      setDetailsLoading(true);
      setDetails(null);
      try {
        const data = await getCalendarItemDetails({
          accountId,
          source_type: event.source_type,
          source_id: event.source_id,
        });
        setDetails(data as Record<string, unknown>);
      } catch (err) {
        toast.error(getErrorMessage(err));
        setDetails(null);
      } finally {
        setDetailsLoading(false);
      }
    },
    [accountId],
  );

  useEffect(() => {
    const loadAssignees = async () => {
      if (!selectedEvent || selectedEvent.source_type !== 'job_event') {
        setAssignees([]);
        return;
      }
      setAssigneesLoading(true);
      try {
        const [rawAssignments, rawMembers] = await Promise.all([
          listJobEventAssignments({ accountId, eventId: selectedEvent.id }),
          listAccountMembers({ accountSlug }),
        ]);
        const assignments = (Array.isArray(rawAssignments) ? rawAssignments : []) as { user_id: string }[];
        const members = (Array.isArray(rawMembers) ? rawMembers : []) as { user_id: string; name: string | null; email: string | null; picture_url?: string | null }[];
        const byId = new Map(members.map((m) => [m.user_id, m]));
        setAssignees(
          assignments
            .map((a) => byId.get(a.user_id))
            .filter(Boolean) as { user_id: string; name: string | null; email: string | null; picture_url?: string | null }[],
        );
      } catch {
        setAssignees([]);
      } finally {
        setAssigneesLoading(false);
      }
    };
    loadAssignees();
  }, [accountId, accountSlug, selectedEvent]);

  const jobEditPath = pathsConfig.app.accountJobEdit?.replace('[account]', accountSlug).replace('[id]', jobId);
  const jobPath = pathsConfig.app.accountJobDetail?.replace('[account]', accountSlug).replace('[id]', jobId);

  return (
    <div className="mt-4 flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 lg:max-w-[70%]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={view === 'month' ? 'default' : 'outline'}
            size="sm"
            className={view === 'month' ? 'bg-zinc-700 hover:bg-zinc-600' : 'border-zinc-600 text-zinc-300'}
            onClick={() => setView('month')}
          >
            <CalendarIcon className="mr-1.5 h-4 w-4" />
            Calendar
          </Button>
          <Button
            type="button"
            variant={view === 'week' ? 'default' : 'outline'}
            size="sm"
            className={view === 'week' ? 'bg-zinc-700 hover:bg-zinc-600' : 'border-zinc-600 text-zinc-300'}
            onClick={() => setView('week')}
          >
            Week
          </Button>
          <Button
            type="button"
            variant={view === 'agenda' ? 'default' : 'outline'}
            size="sm"
            className={view === 'agenda' ? 'bg-zinc-700 hover:bg-zinc-600' : 'border-zinc-600 text-zinc-300'}
            onClick={() => setView('agenda')}
          >
            Upcoming
          </Button>
        </div>
        {loading && events.length === 0 && (
          <p className="text-sm text-zinc-500 mb-2">Loading calendar…</p>
        )}
        <KeelCalendar
          key={view}
          events={events}
          onEventClick={handleEventClick}
          view={view}
          height={420}
          onDatesSet={handleDatesSet}
        />
      </div>

      <aside className="w-full shrink-0 rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-4 lg:w-[30%] lg:min-w-[260px]">
        <h4 className="text-sm font-medium text-zinc-400">Details</h4>
        {detailsLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : !selectedEvent || !details ? (
          <p className="mt-2 text-sm text-zinc-500">Select an item to view details.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {selectedEvent.source_type === 'job_event' ? (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    selectedEvent.event_type === 'site_visit'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-violet-500/20 text-violet-400'
                  }`}
                >
                  {selectedEvent.event_type === 'site_visit' ? 'Site visit' : 'Meeting'}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Deadline
                </span>
              )}
              {details.status && (
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-zinc-300">
                  {(details.status as string).replace('_', ' ')}
                </span>
              )}
              {details.priority && (
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-zinc-300 capitalize">
                  {details.priority as string}
                </span>
              )}
            </div>
            <p className="font-medium text-white">{selectedEvent.title}</p>
            <p className="text-zinc-400">
              {selectedEvent.all_day
                ? formatDate(selectedEvent.start_at)
                : formatDateTime(selectedEvent.start_at)}
            </p>
            {selectedEvent.source_type === 'job_event' && (details.location || selectedEvent.location) && (
              <p className="flex items-center gap-1.5 text-zinc-400">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {(details.location as string) || selectedEvent.location || ''}
              </p>
            )}
            {selectedEvent.job_id && (
              <p className="text-zinc-400">
                Job:{' '}
                <Link href={jobPath ?? '#'} className="text-sky-400 hover:underline">
                  {selectedEvent.source_type === 'job_deadline' ? (details.title as string) : 'View job'}
                </Link>
              </p>
            )}
            {selectedEvent.source_type === 'job_event' && (details.prep_notes || details.outcome_notes) && (
              <div className="rounded border border-zinc-700 bg-[var(--workspace-shell-panel)] p-2 text-zinc-300">
                {details.prep_notes && (
                  <p className="whitespace-pre-wrap text-xs">{(details.prep_notes as string).slice(0, 200)}{(details.prep_notes as string).length > 200 ? '…' : ''}</p>
                )}
                {details.outcome_notes && (
                  <p className="mt-1 whitespace-pre-wrap text-xs">{(details.outcome_notes as string).slice(0, 200)}{(details.outcome_notes as string).length > 200 ? '…' : ''}</p>
                )}
              </div>
            )}
            {selectedEvent.source_type === 'job_event' && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-zinc-400">
                  <Users className="h-3.5 w-3.5" />
                  <span>Assigned team</span>
                </div>
                {assigneesLoading ? (
                  <p className="text-xs text-zinc-500">Loading team…</p>
                ) : assignees.length === 0 ? (
                  <p className="text-xs text-zinc-500">No one assigned yet.</p>
                ) : (
                  <ul className="space-y-0.5 text-xs text-zinc-300">
                    {assignees.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.picture_url ?? undefined} />
                          <AvatarFallback className="bg-zinc-700 text-[10px] text-zinc-200">
                            {(m.name || m.email || m.user_id.slice(0, 2)).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{m.name || m.email || m.user_id.slice(0, 8)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {canEditJobs && selectedEvent.source_type === 'job_event' && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-2 border-zinc-600 text-zinc-300 hover:bg-zinc-700"
              >
                <Link href={jobEditPath ?? '#'}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit (Visits tab)
                </Link>
              </Button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
