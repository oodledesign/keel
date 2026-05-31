'use client';

import { useMemo, useState } from 'react';

import { Loader2, RefreshCcw, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { PlanOutputRenderer } from './PlanOutputRenderer';
import type { PlanningMode } from './planner-types';

type Props = {
  mode: PlanningMode;
  date: string;
  markdown: string;
  isGenerating: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
};

export function PlanOutputPanel({
  mode,
  date,
  markdown,
  isGenerating,
  onRegenerate,
  canRegenerate,
}: Props) {
  const [isPushing, setIsPushing] = useState(false);
  const blocks = useMemo(
    () => parseScheduledBlocks(markdown, date),
    [date, markdown],
  );
  const complete = markdown.trim().length > 0 && !isGenerating;

  async function pushToCalendar() {
    if (blocks.length === 0) {
      toast.error('No scheduled task blocks found in the plan');
      return;
    }

    if (
      !confirm(
        `Create ${blocks.length} task event${blocks.length === 1 ? '' : 's'} in Google Calendar?`,
      )
    ) {
      return;
    }

    setIsPushing(true);
    try {
      const response = await fetch('/api/planner/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, blocks }),
      });
      const body = (await response.json()) as {
        created?: number;
        errors?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not push to Google Calendar');
      }
      toast.success(`Created ${body.created ?? 0} Google Calendar events`);
      if (body.errors?.length) {
        toast.message(`${body.errors.length} events could not be created`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Calendar push failed');
    } finally {
      setIsPushing(false);
    }
  }

  return (
    <section className="min-h-[720px] rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.22)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Generated plan</h2>
          <p className="mt-1 text-sm text-white/45">
            Claude streams the plan here as it thinks through your workload.
          </p>
        </div>
        {isGenerating ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[#5eead4]/20 bg-[#5eead4]/10 px-3 py-1 text-xs text-[#5eead4]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {mode === 'day' ? 'Planning your day…' : 'Planning your week…'}
          </span>
        ) : null}
      </div>

      <div className="min-h-[560px] rounded-2xl border border-white/8 bg-black/10 p-5">
        {markdown.trim() ? (
          <PlanOutputRenderer markdown={markdown} />
        ) : isGenerating ? (
          <div className="flex min-h-[500px] flex-col items-center justify-center text-center text-white/55">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#5eead4]" />
            <p className="font-medium text-white">
              {mode === 'day' ? 'Planning your day…' : 'Planning your week…'}
            </p>
            <p className="mt-1 max-w-sm text-sm">
              Balancing tasks, calendar blocks, buffers, and energy windows.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[500px] flex-col items-center justify-center text-center text-white/50">
            <p className="text-lg font-semibold text-white/70">
              Ready when you are.
            </p>
            <p className="mt-2 max-w-md text-sm">
              Choose tasks and calendar events, then generate a practical plan.
            </p>
          </div>
        )}
      </div>

      {complete ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            disabled={!canRegenerate || isGenerating}
            onClick={onRegenerate}
          >
            <RefreshCcw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={isPushing || blocks.length === 0}
            onClick={pushToCalendar}
          >
            <Send className="h-4 w-4" />
            {isPushing ? 'Pushing…' : 'Push to Google Calendar'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

const lineRe =
  /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*·\s*(?!📅)(.+?)(?:\s*·\s*.+)?$/;

function parseScheduledBlocks(markdown: string, dateIso: string) {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return [];

  let currentDate = new Date(base);
  const blocks: Array<{ title: string; start: string; end: string }> = [];
  const dayOffsets = weekDayOffsets(base);

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const heading = /^###\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.exec(
      line,
    );
    if (heading) {
      const dayName = heading[1];
      if (!dayName) continue;
      const offset = dayOffsets[dayName.toLowerCase()];
      if (offset !== undefined) {
        currentDate = new Date(base);
        currentDate.setDate(base.getDate() + offset);
      }
      continue;
    }

    const match = lineRe.exec(line);
    if (!match) continue;

    const [, sh, sm, eh, em, rawTitle] = match;
    if (!sh || !sm || !eh || !em || !rawTitle) continue;
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    start.setHours(Number(sh), Number(sm), 0, 0);
    end.setHours(Number(eh), Number(em), 0, 0);
    if (end <= start) continue;

    blocks.push({
      title: rawTitle.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  return blocks;
}

function weekDayOffsets(base: Date) {
  const dayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const offsets: Record<string, number> = {};
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dayName = dayNames[d.getDay()];
    if (dayName) offsets[dayName] = i;
  }
  return offsets;
}
