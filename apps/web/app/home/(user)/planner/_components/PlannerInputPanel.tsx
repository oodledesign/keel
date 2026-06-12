'use client';

import Link from 'next/link';

import { CalendarCheck2 } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';
import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';

import type { PlannerWorkspaceNode } from '~/lib/planner/types';
import { CalendarEventsSection } from './CalendarEventsSection';
import { PlanningModeToggle } from './PlanningModeToggle';
import { PreferencesSection } from './PreferencesSection';
import { TaskSelectorTree } from './TaskSelectorTree';
import type {
  PlannerPreferences,
  PlanningMode,
} from './planner-types';

type Props = {
  mode: PlanningMode;
  onModeChange: (mode: PlanningMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  preferences: PlannerPreferences;
  onPreferencesChange: (preferences: PlannerPreferences) => void;
  initialCalendarStatus: { connected: boolean; configured: boolean };
  calendarEvents: PlannerCalendarEvent[];
  onCalendarEventsChange: (events: PlannerCalendarEvent[]) => void;
  selectedCalendarEventIds: Set<string>;
  onSelectedCalendarEventIdsChange: (ids: Set<string>) => void;
  taskTree: PlannerWorkspaceNode[];
  selectedTaskIds: Set<string>;
  onSelectedTaskIdsChange: (ids: Set<string>) => void;
  selectedTaskCount: number;
  includeWorkspaceTasks: boolean;
  settingsHref: string;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function PlannerInputPanel(props: Props) {
  return (
    <section className="space-y-5 rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.22)]">
      <PlanningModeToggle
        mode={props.mode}
        onModeChange={props.onModeChange}
        date={props.date}
        onDateChange={props.onDateChange}
      />

      <PreferencesSection
        preferences={props.preferences}
        onPreferencesChange={props.onPreferencesChange}
      />

      <CalendarEventsSection
        mode={props.mode}
        date={props.date}
        initialStatus={props.initialCalendarStatus}
        events={props.calendarEvents}
        onEventsChange={props.onCalendarEventsChange}
        selectedEventIds={props.selectedCalendarEventIds}
        onSelectedEventIdsChange={props.onSelectedCalendarEventIdsChange}
      />

      <TaskSelectorTree
        taskTree={props.taskTree}
        selectedTaskIds={props.selectedTaskIds}
        onSelectedTaskIdsChange={props.onSelectedTaskIdsChange}
        includeWorkspaceTasks={props.includeWorkspaceTasks}
        settingsHref={props.settingsHref}
      />

      <Button
        type="button"
        className={`w-full ${workspaceBtnPrimaryMd}`}
        disabled={props.selectedTaskCount === 0 || props.isGenerating}
        onClick={props.onGenerate}
      >
        <CalendarCheck2 className="h-4 w-4" />
        {props.isGenerating
          ? 'Planning…'
          : props.mode === 'day'
            ? 'Plan my day'
            : 'Plan my week'}
      </Button>
    </section>
  );
}
