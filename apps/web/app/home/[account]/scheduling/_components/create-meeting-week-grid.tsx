'use client';

import { useMemo } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { workspaceTextMuted } from '~/lib/workspace-ui';

export type HostBusyInterval = {
  start: string;
  end: string;
  source: 'calendar' | 'booking';
};

type Props = {
  weekStartYmd: string;
  selectedDateYmd: string;
  selectedTimeHm: string;
  durationMinutes: number;
  busy: HostBusyInterval[];
  loading?: boolean;
  onWeekChange: (weekStartYmd: string) => void;
  onSelectSlot: (dateYmd: string, timeHm: string) => void;
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const SNAP_MINUTES = 15;
const MINUTES_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const PX_PER_MINUTE = 0.7;
const GRID_HEIGHT = MINUTES_PER_DAY * PX_PER_MINUTE;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function parseYmdLocal(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function startOfWeekMonday(ymd: string) {
  const date = parseYmdLocal(ymd);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toYmd(date);
}

export function addDaysYmd(ymd: string, days: number) {
  const date = parseYmdLocal(ymd);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

export function weekRangeIso(weekStartYmd: string) {
  const from = parseYmdLocal(weekStartYmd);
  from.setHours(0, 0, 0, 0);
  const to = parseYmdLocal(weekStartYmd);
  to.setDate(to.getDate() + 7);
  to.setHours(0, 0, 0, 0);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatHourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDayHeader(ymd: string) {
  const date = parseYmdLocal(ymd);
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: date.getDate(),
  };
}

type PositionedBusy = {
  key: string;
  top: number;
  height: number;
  source: 'calendar' | 'booking';
};

function busyForDay(
  ymd: string,
  busy: HostBusyInterval[],
): PositionedBusy[] {
  const dayStart = parseYmdLocal(ymd);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = parseYmdLocal(ymd);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  const visibleStart = DAY_START_HOUR * 60;
  const visibleEnd = DAY_END_HOUR * 60;

  const items: PositionedBusy[] = [];

  busy.forEach((interval, index) => {
    const start = new Date(interval.start);
    const end = new Date(interval.end);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end.getTime() <= dayStartMs ||
      start.getTime() >= dayEndMs
    ) {
      return;
    }

    const clippedStart = new Date(Math.max(start.getTime(), dayStartMs));
    const clippedEnd = new Date(Math.min(end.getTime(), dayEndMs));
    const startMin = clamp(
      minutesFromMidnight(clippedStart),
      visibleStart,
      visibleEnd,
    );
    const endMin = clamp(
      minutesFromMidnight(clippedEnd),
      visibleStart,
      visibleEnd,
    );
    if (endMin <= startMin) return;

    items.push({
      key: `${interval.source}-${ymd}-${index}-${interval.start}`,
      top: (startMin - visibleStart) * PX_PER_MINUTE,
      height: Math.max((endMin - startMin) * PX_PER_MINUTE, 3),
      source: interval.source,
    });
  });

  return items;
}

export function CreateMeetingWeekGrid({
  weekStartYmd,
  selectedDateYmd,
  selectedTimeHm,
  durationMinutes,
  busy,
  loading = false,
  onWeekChange,
  onSelectSlot,
}: Props) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDaysYmd(weekStartYmd, index)),
    [weekStartYmd],
  );

  const hourMarks = useMemo(
    () =>
      Array.from(
        { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
        (_, index) => DAY_START_HOUR + index,
      ),
    [],
  );

  const weekLabel = useMemo(() => {
    const start = parseYmdLocal(weekStartYmd);
    const end = parseYmdLocal(addDaysYmd(weekStartYmd, 6));
    const startLabel = start.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    const endLabel = end.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${startLabel} – ${endLabel}`;
  }, [weekStartYmd]);

  const selection = useMemo(() => {
    if (!selectedDateYmd || !selectedTimeHm) return null;
    if (!days.includes(selectedDateYmd)) return null;
    const [hours, minutes] = selectedTimeHm.split(':').map(Number);
    const startMin = (hours ?? 0) * 60 + (minutes ?? 0);
    const endMin = startMin + durationMinutes;
    if (endMin <= DAY_START_HOUR * 60 || startMin >= DAY_END_HOUR * 60) {
      return null;
    }
    const visibleStart = DAY_START_HOUR * 60;
    const clippedStart = clamp(startMin, visibleStart, DAY_END_HOUR * 60);
    const clippedEnd = clamp(endMin, visibleStart, DAY_END_HOUR * 60);
    return {
      dateYmd: selectedDateYmd,
      top: (clippedStart - visibleStart) * PX_PER_MINUTE,
      height: Math.max((clippedEnd - clippedStart) * PX_PER_MINUTE, 4),
    };
  }, [days, selectedDateYmd, selectedTimeHm, durationMinutes]);

  function handleColumnClick(
    ymd: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const rawMinutes =
      DAY_START_HOUR * 60 + Math.round(y / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
    const startMin = clamp(
      rawMinutes,
      DAY_START_HOUR * 60,
      DAY_END_HOUR * 60 - SNAP_MINUTES,
    );
    const hours = Math.floor(startMin / 60);
    const minutes = startMin % 60;
    onSelectSlot(ymd, `${pad2(hours)}:${pad2(minutes)}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Schedule
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Busy blocks from connected calendars and confirmed bookings. Click
            to pick a start time.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(addDaysYmd(weekStartYmd, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={`min-w-[9.5rem] text-center text-xs ${workspaceTextMuted}`}>
            {weekLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(addDaysYmd(weekStartYmd, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
          loading && 'opacity-70',
        )}
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `2.75rem repeat(7, minmax(0, 1fr))` }}
        >
          <div className="border-b border-[color:var(--workspace-shell-border)]" />
          {days.map((ymd) => {
            const header = formatDayHeader(ymd);
            const selected = ymd === selectedDateYmd;
            return (
              <div
                key={`header-${ymd}`}
                className={cn(
                  'border-b border-l border-[color:var(--workspace-shell-border)] px-1 py-1.5 text-center',
                  selected && 'bg-[color-mix(in_srgb,var(--ozer-accent)_12%,transparent)]',
                )}
              >
                <p className={`text-[10px] uppercase ${workspaceTextMuted}`}>
                  {header.weekday}
                </p>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    selected
                      ? 'text-[var(--ozer-accent)]'
                      : 'text-[var(--workspace-shell-text)]',
                  )}
                >
                  {header.day}
                </p>
              </div>
            );
          })}

          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hourMarks.map((hour) => (
              <div
                key={hour}
                className={`absolute right-1 -translate-y-1/2 text-[10px] ${workspaceTextMuted}`}
                style={{
                  top: (hour - DAY_START_HOUR) * 60 * PX_PER_MINUTE,
                }}
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>

          {days.map((ymd) => {
            const dayBusy = busyForDay(ymd, busy);
            return (
              <button
                key={`day-${ymd}`}
                type="button"
                className="relative border-l border-[color:var(--workspace-shell-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]"
                style={{ height: GRID_HEIGHT }}
                onClick={(event) => handleColumnClick(ymd, event)}
                aria-label={`Select time on ${ymd}`}
              >
                {hourMarks.slice(0, -1).map((hour) => (
                  <div
                    key={`${ymd}-line-${hour}`}
                    className="pointer-events-none absolute right-0 left-0 border-t border-[color:var(--workspace-shell-border)]/50"
                    style={{
                      top: (hour - DAY_START_HOUR) * 60 * PX_PER_MINUTE,
                    }}
                  />
                ))}

                {dayBusy.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      'pointer-events-none absolute right-0.5 left-0.5 rounded-sm',
                      item.source === 'booking'
                        ? 'bg-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)]'
                        : 'bg-[color-mix(in_srgb,var(--workspace-shell-text)_18%,transparent)]',
                    )}
                    style={{ top: item.top, height: item.height }}
                    title={item.source === 'booking' ? 'Booking' : 'Calendar busy'}
                  />
                ))}

                {selection?.dateYmd === ymd ? (
                  <div
                    className="pointer-events-none absolute right-0.5 left-0.5 rounded-sm border border-[var(--ozer-accent)] bg-[color-mix(in_srgb,var(--ozer-accent)_45%,transparent)]"
                    style={{ top: selection.top, height: selection.height }}
                    title="Selected meeting"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex flex-wrap gap-3 text-[11px] ${workspaceTextMuted}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[color-mix(in_srgb,var(--workspace-shell-text)_18%,transparent)]" />
          Calendar busy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)]" />
          Confirmed booking
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-[var(--ozer-accent)] bg-[color-mix(in_srgb,var(--ozer-accent)_45%,transparent)]" />
          Selected
        </span>
      </div>
    </div>
  );
}
