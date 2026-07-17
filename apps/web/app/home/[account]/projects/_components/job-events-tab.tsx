'use client';

import { useCallback, useEffect, useState } from 'react';

import { CalendarPlus, MapPin, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '../_lib/error-message';
import {
  createJobEvent,
  deleteJobEvent,
  listAccountMembers,
  listJobEventAssignmentsForJob,
  listJobEvents,
  updateJobEvent,
} from '../_lib/server/server-actions';
import { JobEventForm } from './job-event-form';

export type JobEventRow = {
  id: string;
  account_id: string;
  job_id: string;
  title: string;
  event_type: 'site_visit' | 'meeting';
  scheduled_start_at: string;
  scheduled_end_at: string | null;
  location: string | null;
  prep_notes: string | null;
  outcome_notes: string | null;
  follow_up_required: boolean;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

type MemberInfo = {
  user_id: string;
  name: string | null;
  email: string | null;
  picture_url?: string | null;
};
type AssignmentRow = {
  job_event_id: string;
  user_id: string;
  role_on_event: string | null;
};

function formatEventDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function snippet(text: string | null, maxLen: number): string {
  if (!text || !text.trim()) return '—';
  const t = text.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + '…';
}

function EventCardAssignees({
  eventId,
  assignmentsByEvent,
  members,
}: {
  eventId: string;
  assignmentsByEvent: Record<string, AssignmentRow[]>;
  members: MemberInfo[];
}) {
  const assignments = assignmentsByEvent[eventId] ?? [];
  if (assignments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Users className="h-3.5 w-3.5 text-[var(--workspace-shell-text-muted)]" />
      {assignments.map((a) => {
        const m = members.find((x) => x.user_id === a.user_id);
        const label = m
          ? m.name || m.email || a.user_id.slice(0, 8)
          : a.user_id.slice(0, 8);
        return (
          <div
            key={a.user_id}
            className="flex items-center gap-1 rounded-full bg-[var(--workspace-shell-panel-hover)]/80 px-2 py-0.5"
          >
            <Avatar className="h-5 w-5 rounded-full">
              <AvatarImage src={m?.picture_url ?? undefined} />
              <AvatarFallback className="bg-[var(--workspace-shell-panel-hover)] text-[10px] text-[var(--workspace-shell-text-muted)]">
                {(label || '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function JobEventsTabContent({
  accountSlug,
  accountId,
  jobId,
  canEditJobs,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  canEditJobs: boolean;
}) {
  const [upcoming, setUpcoming] = useState<JobEventRow[]>([]);
  const [previous, setPrevious] = useState<JobEventRow[]>([]);
  const [assignmentsByEvent, setAssignmentsByEvent] = useState<
    Record<string, AssignmentRow[]>
  >({});
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreate, setIsCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsResult, assignmentsResult, membersResult] =
        await Promise.all([
          listJobEvents({ accountId, jobId }),
          listJobEventAssignmentsForJob({ accountId, jobId }),
          accountSlug
            ? listAccountMembers({ accountSlug })
            : Promise.resolve([]),
        ]);
      const raw = eventsResult as {
        upcoming?: unknown[];
        previous?: unknown[];
      };
      setUpcoming((raw.upcoming ?? []) as JobEventRow[]);
      setPrevious((raw.previous ?? []) as JobEventRow[]);
      const assignments = (assignmentsResult ?? []) as AssignmentRow[];
      const byEvent: Record<string, AssignmentRow[]> = {};
      for (const a of assignments) {
        if (!byEvent[a.job_event_id]) byEvent[a.job_event_id] = [];
        byEvent[a.job_event_id].push(a);
      }
      setAssignmentsByEvent(byEvent);
      setMembers(
        (Array.isArray(membersResult) ? membersResult : []) as MemberInfo[],
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
      setUpcoming([]);
      setPrevious([]);
      setAssignmentsByEvent({});
    } finally {
      setLoading(false);
    }
  }, [accountId, jobId, accountSlug]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const openCreate = () => {
    setIsCreate(true);
    setSelectedEventId(null);
    setSheetOpen(true);
  };

  const openEvent = (eventId: string) => {
    setIsCreate(false);
    setSelectedEventId(eventId);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedEventId(null);
    setIsCreate(false);
    fetchEvents();
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteJobEvent({ accountId, eventId });
      toast.success('Visit/meeting deleted');
      closeSheet();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="mt-4 space-y-8">
      {canEditJobs && (
        <div>
          <Button
            type="button"
            size="sm"
            className="bg-[var(--workspace-shell-panel-hover)] hover:bg-[var(--workspace-shell-panel-hover)]"
            onClick={openCreate}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Add visit/meeting
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : (
        <>
          <section>
            <h3 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                No upcoming visits or meetings.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => openEvent(event.id)}
                      className="w-full rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-left transition hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel-hover)]"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        <span className="font-medium text-[var(--workspace-shell-text-muted)]">
                          {formatEventDateTime(event.scheduled_start_at)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                            event.event_type === 'site_visit'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-violet-500/20 text-violet-400'
                          }`}
                        >
                          {event.event_type === 'site_visit'
                            ? 'Site visit'
                            : 'Meeting'}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1 text-[var(--workspace-shell-text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-[200px] truncate">
                              {event.location}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 font-medium text-[var(--workspace-shell-text)]">
                        {event.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-1">
                        <p className="min-w-0 flex-1 basis-0 text-sm text-[var(--workspace-shell-text-muted)]">
                          {snippet(event.prep_notes, 120)}
                        </p>
                        <div className="shrink-0">
                          <EventCardAssignees
                            eventId={event.id}
                            assignmentsByEvent={assignmentsByEvent}
                            members={members}
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
              Previous
            </h3>
            {previous.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                No previous visits or meetings.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {previous.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => openEvent(event.id)}
                      className="w-full rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-left transition hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel-hover)]"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        <span className="font-medium text-[var(--workspace-shell-text-muted)]">
                          {formatEventDateTime(event.scheduled_start_at)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                            event.event_type === 'site_visit'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-violet-500/20 text-violet-400'
                          }`}
                        >
                          {event.event_type === 'site_visit'
                            ? 'Site visit'
                            : 'Meeting'}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1 text-[var(--workspace-shell-text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-[200px] truncate">
                              {event.location}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 font-medium text-[var(--workspace-shell-text)]">
                        {event.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-1">
                        <p className="min-w-0 flex-1 basis-0 text-sm text-[var(--workspace-shell-text-muted)]">
                          {snippet(event.outcome_notes, 120)}
                        </p>
                        <div className="shrink-0">
                          <EventCardAssignees
                            eventId={event.id}
                            assignmentsByEvent={assignmentsByEvent}
                            members={members}
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex flex-col border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] max-sm:w-full sm:max-w-lg">
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-[var(--workspace-shell-text)]">
              {isCreate ? 'Add visit/meeting' : 'Visit / meeting'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            <JobEventForm
              key={isCreate ? 'create' : (selectedEventId ?? 'create')}
              accountSlug={accountSlug}
              accountId={accountId}
              jobId={jobId}
              eventId={selectedEventId}
              isCreate={isCreate}
              canEditJobs={canEditJobs}
              onSuccess={closeSheet}
              onDelete={
                isCreate
                  ? undefined
                  : selectedEventId
                    ? () => handleDelete(selectedEventId)
                    : undefined
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
