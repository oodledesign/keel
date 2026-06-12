'use client';

import { useEffect, useMemo, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import {
  saveStoredPlan,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';

import { PlannerInputPanel } from './PlannerInputPanel';
import { PlanOutputPanel } from './PlanOutputPanel';
import { PlannerViewTabs } from './PlannerViewTabs';
import { SopSuggestionsStrip } from './SopSuggestionsStrip';
import {
  plannerTaskToPayload,
  type PlannerGeneratePayload,
  type PlannerPageClientProps,
  type PlannerPreferences,
  type PlanningMode,
} from './planner-types';

const defaultPreferences: PlannerPreferences = {
  workingHours: { start: '08:30', end: '17:30' },
  deepWorkPreference: 'morning',
  userContext: '',
};

export function PlannerPageClient({ initialData }: PlannerPageClientProps) {
  const allTaskIds = useMemo(
    () =>
      new Set(
        initialData.taskTree.flatMap((workspace) =>
          workspace.projects.flatMap((project) =>
            project.tasks.map((task) => task.id),
          ),
        ),
      ),
    [initialData.taskTree],
  );

  const [mode, setMode] = useState<PlanningMode>('day');
  const [date, setDate] = useState(() => new Date().toISOString());
  const [preferences, setPreferences] =
    useState<PlannerPreferences>(defaultPreferences);
  const [calendarEvents, setCalendarEvents] = useState<PlannerCalendarEvent[]>(
    [],
  );
  const [selectedCalendarEventIds, setSelectedCalendarEventIds] = useState<
    Set<string>
  >(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(allTaskIds);
  const [planMarkdown, setPlanMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastPayload, setLastPayload] = useState<PlannerGeneratePayload | null>(
    null,
  );

  useEffect(() => {
    const raw = window.localStorage.getItem('keel-planner-preferences');
    if (!raw) return;
    try {
      setPreferences({ ...defaultPreferences, ...JSON.parse(raw) });
    } catch {
      // Ignore invalid local preference state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'keel-planner-preferences',
      JSON.stringify(preferences),
    );
  }, [preferences]);

  const selectedTasks = useMemo(
    () =>
      initialData.taskTree
        .flatMap((workspace) => workspace.projects)
        .flatMap((project) => project.tasks)
        .filter((task) => selectedTaskIds.has(task.id))
        .map(plannerTaskToPayload),
    [initialData.taskTree, selectedTaskIds],
  );

  const selectedCalendarEvents = useMemo(
    () =>
      calendarEvents
        .filter((event) => selectedCalendarEventIds.has(event.id))
        .map(({ id: _id, ...event }) => event),
    [calendarEvents, selectedCalendarEventIds],
  );

  function buildPayload(): PlannerGeneratePayload {
    return {
      planning_mode: mode,
      date,
      working_hours: preferences.workingHours,
      deep_work_preference: preferences.deepWorkPreference,
      user_context: preferences.userContext,
      calendar_events: selectedCalendarEvents,
      tasks: selectedTasks,
    };
  }

  async function generatePlan(payload = buildPayload()) {
    if (payload.tasks.length === 0) {
      toast.error('Choose at least one task to plan');
      return;
    }

    setLastPayload(payload);
    setPlanMarkdown('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? 'Could not generate plan');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
        setPlanMarkdown(accumulated);
      }

      if (accumulated.trim()) {
        saveStoredPlan(initialData.scope, toLocalDateYmd(new Date(date)), {
          markdown: accumulated,
          updatedAt: new Date().toISOString(),
          mode,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate plan');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planner</h1>
          <p className="mt-1 text-sm text-white/55">
            {initialData.scope.kind === 'workspace'
              ? `Plan ${initialData.scope.accountName} tasks — or everything across Keel when unified view is on.`
              : 'Turn your open tasks and calendar into a practical day or week plan.'}
          </p>
        </div>
        <PlannerViewTabs
          dayHref={initialData.dayViewHref}
          planHref={initialData.planViewHref}
          active="plan"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)]">
        <PlannerInputPanel
          mode={mode}
          onModeChange={setMode}
          date={date}
          onDateChange={setDate}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          initialCalendarStatus={initialData.calendar}
          calendarEvents={calendarEvents}
          onCalendarEventsChange={setCalendarEvents}
          selectedCalendarEventIds={selectedCalendarEventIds}
          onSelectedCalendarEventIdsChange={setSelectedCalendarEventIds}
          taskTree={initialData.taskTree}
          selectedTaskIds={selectedTaskIds}
          onSelectedTaskIdsChange={setSelectedTaskIds}
          selectedTaskCount={selectedTasks.length}
          includeWorkspaceTasks={initialData.includeWorkspaceTasks}
          settingsHref={initialData.settingsHref}
          onGenerate={() => generatePlan()}
          isGenerating={isGenerating}
        />
        <div className="space-y-4">
          <PlanOutputPanel
            mode={mode}
            date={date}
            markdown={planMarkdown}
            isGenerating={isGenerating}
            onRegenerate={() => lastPayload && generatePlan(lastPayload)}
            canRegenerate={Boolean(lastPayload)}
            dayViewHref={initialData.dayViewHref}
          />
          <SopSuggestionsStrip suggestions={initialData.sopSuggestions} />
        </div>
      </div>
    </div>
  );
}
