'use client';

import { useState } from 'react';

import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import { savePlannerPlanAction } from '~/lib/planner/plan-actions';
import {
  plannerScopeKey,
  saveStoredPlan,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';
import type { PlannerScope, PlannerTask } from '~/lib/planner/types';

import {
  plannerTaskToPayload,
  type DeepWorkPreference,
  type PlannerPreferences,
} from './planner-types';

const defaultPreferences: PlannerPreferences = {
  workingHours: { start: '08:30', end: '17:30' },
  deepWorkPreference: 'morning',
  userContext: '',
};

function loadPlannerPreferences(): PlannerPreferences {
  if (typeof window === 'undefined') return defaultPreferences;
  const raw = window.localStorage.getItem('keel-planner-preferences');
  if (!raw) return defaultPreferences;
  try {
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

function formatCurrentTime(now: Date) {
  return now.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildReplanNotes(input: {
  whereIAm: string;
  notDone: string;
  stillNeeded: string;
}) {
  const parts: string[] = [];
  if (input.whereIAm.trim()) {
    parts.push(`Where I am in the day:\n${input.whereIAm.trim()}`);
  }
  if (input.notDone.trim()) {
    parts.push(`What I haven't managed to do:\n${input.notDone.trim()}`);
  }
  if (input.stillNeeded.trim()) {
    parts.push(`What else needs to be done:\n${input.stillNeeded.trim()}`);
  }
  return parts.join('\n\n');
}

type Props = {
  scope: PlannerScope;
  planMarkdown: string;
  openTasks: PlannerTask[];
  calendarEvents: PlannerCalendarEvent[];
  onPlanUpdated: (markdown: string) => void;
};

export function ReplanDialog({
  scope,
  planMarkdown,
  openTasks,
  calendarEvents,
  onPlanUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [whereIAm, setWhereIAm] = useState('');
  const [notDone, setNotDone] = useState('');
  const [stillNeeded, setStillNeeded] = useState('');
  const [isReplanning, setIsReplanning] = useState(false);

  function resetForm() {
    setWhereIAm('');
    setNotDone('');
    setStillNeeded('');
  }

  async function handleReplan() {
    const notes = buildReplanNotes({ whereIAm, notDone, stillNeeded });
    if (!notes.trim()) {
      toast.error('Add a few notes so the planner knows what to change');
      return;
    }

    const preferences = loadPlannerPreferences();
    const now = new Date();
    const dateYmd = toLocalDateYmd(now);

    setIsReplanning(true);

    try {
      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planning_mode: 'day',
          date: now.toISOString(),
          working_hours: preferences.workingHours,
          deep_work_preference: preferences.deepWorkPreference as DeepWorkPreference,
          user_context: preferences.userContext,
          calendar_events: calendarEvents.map(({ id: _id, ...event }) => event),
          tasks: openTasks.map(plannerTaskToPayload),
          replan: {
            current_time: formatCurrentTime(now),
            existing_plan_markdown: planMarkdown,
            notes,
          },
        }),
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? 'Could not re-plan');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
      }

      if (!accumulated.trim()) {
        throw new Error('The planner returned an empty plan');
      }

      saveStoredPlan(scope, dateYmd, {
        markdown: accumulated,
        updatedAt: new Date().toISOString(),
        mode: 'day',
      });

      const saveResult = await savePlannerPlanAction({
        scopeKey: plannerScopeKey(scope),
        planDate: dateYmd,
        mode: 'day',
        markdown: accumulated,
      });

      onPlanUpdated(accumulated);
      setOpen(false);
      resetForm();

      if (saveResult.success) {
        toast.success('Day re-planned from now');
      } else {
        toast.error(
          'Re-plan generated but could not be saved. It is kept in this browser only.',
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not re-plan');
    } finally {
      setIsReplanning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isReplanning) {
          setOpen(next);
          if (!next) resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/80 hover:bg-white/[0.08] hover:text-[var(--workspace-shell-text)]"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Re-plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-plan the rest of today</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text)]/55">
            Tell the planner where you are now. It will keep what is already
            done, then schedule the remainder of the day from{' '}
            <span className="font-medium text-[var(--workspace-shell-text)]/70" suppressHydrationWarning>
              {formatCurrentTime(new Date())}
            </span>{' '}
            onwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="replan-where" className="text-[var(--workspace-shell-text)]/80">
              Where I am in the day
            </Label>
            <Textarea
              id="replan-where"
              value={whereIAm}
              onChange={(event) => setWhereIAm(event.target.value)}
              placeholder="e.g. Just finished the client call, running 20 minutes behind…"
              rows={2}
              className="resize-none border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="replan-not-done" className="text-[var(--workspace-shell-text)]/80">
              What I haven&apos;t managed to do
            </Label>
            <Textarea
              id="replan-not-done"
              value={notDone}
              onChange={(event) => setNotDone(event.target.value)}
              placeholder="e.g. Didn't start the proposal draft or reply to Sarah's email…"
              rows={3}
              className="resize-none border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="replan-still-needed" className="text-[var(--workspace-shell-text)]/80">
              What else needs to be done
            </Label>
            <Textarea
              id="replan-still-needed"
              value={stillNeeded}
              onChange={(event) => setStillNeeded(event.target.value)}
              placeholder="e.g. Need to prep slides for tomorrow's meeting and pick up groceries…"
              rows={3}
              className="resize-none border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            disabled={isReplanning}
            onClick={() => setOpen(false)}
            className="text-[var(--workspace-shell-text)]/60 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isReplanning}
            onClick={() => void handleReplan()}
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {isReplanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Re-planning…
              </>
            ) : (
              'Re-plan from now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
