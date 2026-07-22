'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import { savePlannerPlanAction } from '~/lib/planner/plan-actions';
import {
  type PlanDocument,
  attachGoogleEventIdsToPlan,
  dedupePlanDocument,
  flattenPlanBlocks,
  parsePlanDocument,
  serializePlanDocument,
} from '~/lib/planner/plan-blocks';
import {
  applySyncMappingsToDocument,
  blocksForCalendarSync,
  planGainedGoogleIds,
} from '~/lib/planner/plan-calendar-sync';
import {
  plannerScopeKey,
  saveStoredPlan,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';
import { syncPlannerCalendarBlocks } from '~/lib/planner/sync-calendar-client';

import { PlanOutputPanel } from './PlanOutputPanel';
import { PlannerInputPanel } from './PlannerInputPanel';
import { PlannerViewTabs } from './PlannerViewTabs';
import { SopSuggestionsStrip } from './SopSuggestionsStrip';
import {
  type PlannerGeneratePayload,
  type PlannerPageClientProps,
  type PlannerPreferences,
  type PlanningMode,
  plannerTaskToPayload,
} from './planner-types';

const defaultPreferences: PlannerPreferences = {
  workingHours: { start: '08:30', end: '17:30' },
  deepWorkPreference: 'morning',
  userContext: '',
};

export function PlannerPageClient({ initialData }: PlannerPageClientProps) {
  const previousTaskIdsRef = useRef(
    new Set(
      initialData.taskTree.flatMap((workspace) =>
        workspace.projects.flatMap((project) =>
          project.tasks.map((task) => task.id),
        ),
      ),
    ),
  );

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
  const [selectedTaskIds, setSelectedTaskIds] =
    useState<Set<string>>(allTaskIds);
  const [planMarkdown, setPlanMarkdown] = useState(
    initialData.savedPlanMarkdown ?? '',
  );
  const [planDocument, setPlanDocument] = useState<PlanDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastPayload, setLastPayload] = useState<PlannerGeneratePayload | null>(
    null,
  );

  useEffect(() => {
    const currentIds = allTaskIds;
    const added = [...currentIds].filter(
      (id) => !previousTaskIdsRef.current.has(id),
    );

    if (added.length > 0) {
      setSelectedTaskIds((existing) => {
        const next = new Set(existing);
        for (const id of added) {
          next.add(id);
        }
        return next;
      });
    }

    previousTaskIdsRef.current = currentIds;
  }, [allTaskIds]);

  useEffect(() => {
    const raw =
      window.localStorage.getItem('ozer-planner-preferences') ??
      window.localStorage.getItem('keel-planner-preferences');
    if (!raw) return;
    try {
      setPreferences({ ...defaultPreferences, ...JSON.parse(raw) });
    } catch {
      // Ignore invalid local preference state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'ozer-planner-preferences',
      JSON.stringify(preferences),
    );
    window.localStorage.removeItem('keel-planner-preferences');
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

  const persistPlanDocument = useCallback(
    async (document: PlanDocument) => {
      const markdown = serializePlanDocument(document);
      setPlanMarkdown(markdown);
      setPlanDocument(document);

      const dateYmd = toLocalDateYmd(new Date(date));

      saveStoredPlan(initialData.scope, dateYmd, {
        markdown,
        updatedAt: new Date().toISOString(),
        mode,
      });

      const result = await savePlannerPlanAction({
        scopeKey: plannerScopeKey(initialData.scope),
        planDate: dateYmd,
        mode,
        markdown,
      });

      if (!result.success) {
        toast.error(
          result.error ??
            'Changes saved locally but could not sync to your account.',
        );
      }
    },
    [date, initialData.scope, mode],
  );

  useEffect(() => {
    if (!planMarkdown.trim() || isGenerating) {
      if (!planMarkdown.trim()) {
        setPlanDocument(null);
      }
      return;
    }

    const dateYmd = toLocalDateYmd(new Date(date));
    const dateIso = `${dateYmd}T12:00:00`;
    let doc = parsePlanDocument(planMarkdown);

    if (mode === 'day' && calendarEvents.length > 0) {
      const enriched = dedupePlanDocument(
        attachGoogleEventIdsToPlan(
          doc,
          calendarEvents.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start,
            calendarId: event.calendar_id,
          })),
          dateIso,
        ),
      );

      if (planGainedGoogleIds(doc, enriched)) {
        void persistPlanDocument(enriched);
        return;
      }

      doc = enriched;
    }

    setPlanDocument(doc);
  }, [
    calendarEvents,
    date,
    isGenerating,
    mode,
    persistPlanDocument,
    planMarkdown,
  ]);

  const syncBlockToGoogle = useCallback(
    async (document: PlanDocument, blockId: string) => {
      const block = flattenPlanBlocks(document).find(
        (item) => item.id === blockId,
      );
      if (!block?.googleEventId) {
        return null;
      }

      const dateIso = `${toLocalDateYmd(new Date(date))}T12:00:00`;
      const blocks = blocksForCalendarSync(document, dateIso).filter(
        (item) => item.blockId === blockId,
      );
      if (blocks.length === 0) {
        return null;
      }

      try {
        const result = await syncPlannerCalendarBlocks({
          date: dateIso,
          blocks,
        });
        if (result.errors.length > 0) {
          toast.message('Google Calendar could not update one or more events');
        }
        return applySyncMappingsToDocument(document, result.mappings);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Could not update Google Calendar',
        );
        return null;
      }
    },
    [date],
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
        const dateYmd = toLocalDateYmd(new Date(date));

        saveStoredPlan(initialData.scope, dateYmd, {
          markdown: accumulated,
          updatedAt: new Date().toISOString(),
          mode,
        });

        const result = await savePlannerPlanAction({
          scopeKey: plannerScopeKey(initialData.scope),
          planDate: dateYmd,
          mode,
          markdown: accumulated,
        });

        if (result.success) {
          toast.success(
            mode === 'day'
              ? 'Plan saved — see it on the Today view'
              : 'Plan saved',
          );
        } else {
          toast.error(
            'Plan generated but could not be saved. It is kept in this browser only.',
          );
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not generate plan',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className={workspacePageMainClassName}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planner</h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/55">
            {initialData.scope.kind === 'workspace'
              ? `Plan ${initialData.scope.accountName} tasks — or everything across Ozer when unified view is on.`
              : 'Turn your open tasks and calendar into a practical day or week plan.'}
          </p>
        </div>
        <PlannerViewTabs
          dayHref={initialData.dayViewHref}
          planHref={initialData.planViewHref}
          active="plan"
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
          scope={initialData.scope}
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
            planDocument={planDocument}
            onPlanDocumentChange={setPlanDocument}
            onPersistPlanDocument={persistPlanDocument}
            onSyncBlock={syncBlockToGoogle}
          />
          <SopSuggestionsStrip suggestions={initialData.sopSuggestions} />
        </div>
      </div>
    </div>
  );
}
