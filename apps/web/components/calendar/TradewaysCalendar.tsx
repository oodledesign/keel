'use client';

import { useMemo } from 'react';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

import type { EventClickArg } from '@fullcalendar/core';

/** Normalized calendar item (from server). */
export type CalendarItemNormalized = {
  id: string;
  source_type: 'job_event' | 'job_deadline';
  source_id: string;
  title: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  job_id?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  event_type?: 'site_visit' | 'meeting';
  location?: string | null;
};

/** FullCalendar event shape we pass to the calendar. */
type FCEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    source_type: 'job_event' | 'job_deadline';
    source_id: string;
    job_id?: string;
    client_id?: string;
    status?: string;
    priority?: string;
    event_type?: 'site_visit' | 'meeting';
    location?: string | null;
  };
};

function normalizeToFC(events: CalendarItemNormalized[]): FCEvent[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_at,
    end: e.end_at,
    allDay: e.all_day,
    extendedProps: {
      source_type: e.source_type,
      source_id: e.source_id,
      job_id: e.job_id,
      client_id: e.client_id,
      status: e.status,
      priority: e.priority,
      event_type: e.event_type,
      location: e.location,
    },
  }));
}

/** Event payload passed to onEventClick (normalized item + FC click arg). */
export type CalendarEventClickPayload = CalendarItemNormalized & { _fc?: EventClickArg };

export type KeelCalendarView = 'month' | 'week' | 'agenda';

export type KeelCalendarProps = {
  events: CalendarItemNormalized[];
  onEventClick?: (event: CalendarEventClickPayload) => void;
  view?: KeelCalendarView;
  height?: string | number;
  /** Called when visible date range changes (for refetch). */
  onDatesSet?: (range: { start: Date; end: Date }) => void;
};

export function KeelCalendar({
  events,
  onEventClick,
  view = 'month',
  height = 500,
  onDatesSet,
}: KeelCalendarProps) {
  const fcEvents = useMemo(() => normalizeToFC(events), [events]);

  const initialView =
    view === 'agenda' ? 'listYear' : view === 'week' ? 'timeGridWeek' : 'dayGridMonth';

  const handleEventClick = (arg: EventClickArg) => {
    const ext = arg.event.extendedProps as FCEvent['extendedProps'];
    const raw = events.find((e) => e.id === arg.event.id);
    if (raw && onEventClick) {
      onEventClick({ ...raw, _fc: arg });
    }
  };

  return (
    <div className="keel-calendar rounded-xl border border-white/10 bg-[color-mix(in_oklab,var(--workspace-shell-panel)_92%,black_8%)] p-3 shadow-sm [&_.fc]:border-0 [&_.fc]:bg-transparent [&_.fc-scrollgrid]:border-zinc-900/60 [&_.fc-col-header-cell]:border-zinc-900/60 [&_.fc-col-header-cell]:bg-transparent [&_.fc-col-header-cell-cushion]:py-2 [&_.fc-col-header-cell-cushion]:text-xs [&_.fc-col-header-cell-cushion]:text-zinc-400 [&_.fc-day]:border-zinc-900/60 [&_.fc-daygrid-day-number]:text-zinc-500 [&_.fc-toolbar]:mb-3 [&_.fc-toolbar-title]:text-xs [&_.fc-toolbar-title]:font-medium [&_.fc-toolbar-title]:text-zinc-300 [&_.fc-button]:h-8 [&_.fc-button]:rounded-md [&_.fc-button]:border border-[color:var(--workspace-control-border)] [&_.fc-button]:bg-[var(--workspace-control-surface)] [&_.fc-button]:px-3 [&_.fc-button]:text-[11px] [&_.fc-button]:font-medium [&_.fc-button]:text-zinc-300 [&_.fc-button:hover]:bg-[var(--workspace-shell-panel-hover)] [&_.fc-button-primary]:text-zinc-100 [&_.fc-button-primary]:shadow-none [&_.fc-button-primary:not(:disabled)]:bg-transparent [&_.fc-button-primary:not(:disabled)]:text-zinc-100 [&_.fc-today-button]:rounded-full [&_.fc-today-button]:px-4 [&_.fc-today-button]:bg-transparent [&_.fc-today-button]:border-dashed [&_.fc-today-button]:border-[color:var(--workspace-control-border)] [&_.fc-today-button:hover]:bg-[var(--workspace-shell-panel-hover)]/70 [&_.fc-event]:!bg-transparent [&_.fc-event]:!border-none [&_.fc-list-day-cushion]:bg-transparent [&_.fc-list-day-text]:text-xs [&_.fc-list-day-text]:font-medium [&_.fc-list-day-text]:text-zinc-400 [&_.fc-list-day-side-text]:text-xs [&_.fc-list-day-side-text]:text-zinc-500 [&_.fc-list-event]:border-zinc-900/60 [&_.fc-list-event-title]:text-zinc-200 [&_.fc-list-event-time]:text-zinc-400 [&_.fc-list-empty]:text-zinc-500">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView}
        events={fcEvents}
        eventClick={handleEventClick}
        editable={false}
        selectable={false}
        height={height}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        datesSet={(arg) => onDatesSet?.({ start: arg.start, end: arg.end })}
        eventContent={(arg) => {
          const ext = arg.event.extendedProps as FCEvent['extendedProps'];
          const isDeadline = ext.source_type === 'job_deadline';
          const isOverdue =
            isDeadline &&
            arg.event.end &&
            new Date(arg.event.end) < new Date() &&
            arg.event.allDay;
          const baseColor = isDeadline
            ? 'bg-amber-500/10 text-amber-200/90 border-amber-500/30'
            : 'bg-emerald-500/8 text-emerald-200/90 border-emerald-500/25';
          const overdueRing = isOverdue ? 'ring-1 ring-amber-400/40' : '';

          return (
            <div className="fc-event-main-frame">
              <div
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] leading-tight ${baseColor} ${overdueRing}`}
              >
                <span className="truncate">{arg.event.title}</span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
