'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import { parseDayScheduleFromMarkdown } from '~/lib/planner/parse-plan-markdown';
import {
  loadStoredPlan,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';
import type { DayViewData } from '~/lib/planner/types';

import { PlannerViewTabs } from './PlannerViewTabs';
import { SopSuggestionsStrip } from './SopSuggestionsStrip';

type Props = {
  initialData: DayViewData;
  dayViewHref: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

export function DayViewClient({ initialData, dayViewHref }: Props) {
  const dateYmd = toLocalDateYmd();
  const [planMarkdown, setPlanMarkdown] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<PlannerCalendarEvent[]>(
    [],
  );

  useEffect(() => {
    const stored = loadStoredPlan(initialData.scope, dateYmd);
    setPlanMarkdown(stored?.markdown ?? '');
  }, [initialData.scope, dateYmd]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      try {
        const response = await fetch(
          `/api/planner/calendar?mode=day&date=${encodeURIComponent(new Date().toISOString())}`,
        );
        const body = (await response.json()) as {
          events?: PlannerCalendarEvent[];
        };
        if (!cancelled) {
          setCalendarEvents(body.events ?? []);
        }
      } catch {
        if (!cancelled) setCalendarEvents([]);
      }
    }

    void loadCalendar();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleBlocks = useMemo(
    () => parseDayScheduleFromMarkdown(planMarkdown, new Date().toISOString()),
    [planMarkdown],
  );

  const hasPlan = planMarkdown.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-white/55">
            {initialData.scope.kind === 'workspace'
              ? `${initialData.scope.accountName} — your schedule and due tasks`
              : 'Your schedule and tasks due today'}
          </p>
        </div>
        <PlannerViewTabs
          dayHref={dayViewHref}
          planHref={initialData.planViewHref}
          active="day"
        />
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/80">Schedule</h2>
        {!hasPlan && scheduleBlocks.length === 0 && calendarEvents.length === 0 ? (
          <EmptySchedule planHref={initialData.planViewHref} />
        ) : (
          <div className="space-y-2">
            {scheduleBlocks.map((block) => (
              <ScheduleRow
                key={`${block.start}-${block.title}`}
                time={`${formatTime(block.start)} – ${formatTime(block.end)}`}
                title={block.title}
                tone={block.isCalendarEvent ? 'calendar' : 'task'}
              />
            ))}
            {scheduleBlocks.length === 0 && calendarEvents.length > 0
              ? calendarEvents.map((event) => (
                  <ScheduleRow
                    key={event.id}
                    time={`${formatTime(event.start)} – ${formatTime(event.end)}`}
                    title={event.title}
                    tone="calendar"
                  />
                ))
              : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white/80">Due today</h2>
          <span className="text-xs text-white/40">
            {initialData.tasksDueToday.length} task
            {initialData.tasksDueToday.length === 1 ? '' : 's'}
          </span>
        </div>
        {initialData.tasksDueToday.length === 0 ? (
          <p className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
            Nothing due today.
          </p>
        ) : (
          <ul className="space-y-2">
            {initialData.tasksDueToday.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] px-4 py-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {task.workspace}
                    {task.project !== 'No project' ? ` · ${task.project}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SopSuggestionsStrip suggestions={initialData.sopSuggestions} />

      {!initialData.includeWorkspaceTasks ? (
        <p className="text-center text-xs text-white/35">
          Workspace tasks hidden —{' '}
          <Link
            href={initialData.settingsHref}
            className="text-[#2A9D8F] hover:underline"
          >
            change in settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function ScheduleRow({
  time,
  title,
  tone,
}: {
  time: string;
  title: string;
  tone: 'calendar' | 'task';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        tone === 'calendar'
          ? 'border-sky-400/15 bg-sky-400/10'
          : 'border-white/8 bg-[var(--workspace-shell-panel)]',
      )}
    >
      <CalendarClock
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          tone === 'calendar' ? 'text-sky-300/80' : 'text-[#5eead4]',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-white/45">{time}</p>
        <p className="mt-0.5 text-sm font-medium text-white">{title}</p>
      </div>
    </div>
  );
}

function EmptySchedule({ planHref }: { planHref: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-[#5eead4]/70" />
      <p className="mt-3 text-sm text-white/60">No plan for today yet.</p>
      <Button asChild className="mt-4 bg-[var(--keel-teal)] hover:bg-[#238b7f]">
        <Link href={planHref}>Plan my day</Link>
      </Button>
    </div>
  );
}
