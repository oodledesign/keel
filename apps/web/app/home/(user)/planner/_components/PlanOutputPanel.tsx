'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Loader2, RefreshCcw, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';
import { parseScheduledBlocksForCalendarPush } from '~/lib/planner/parse-plan-markdown';

import { PlanOutputRenderer } from './PlanOutputRenderer';
import type { PlanningMode } from './planner-types';

type Props = {
  mode: PlanningMode;
  date: string;
  markdown: string;
  isGenerating: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
  dayViewHref?: string;
};

export function PlanOutputPanel({
  mode,
  date,
  markdown,
  isGenerating,
  onRegenerate,
  canRegenerate,
  dayViewHref,
}: Props) {
  const [isPushing, setIsPushing] = useState(false);
  const blocks = useMemo(
    () => parseScheduledBlocksForCalendarPush(markdown, date),
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
    <section className="sticky top-4 min-h-[min(80vh,720px)] rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.22)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Generated plan</h2>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            Preview updates as Claude streams your schedule.
          </p>
        </div>
        {isGenerating ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ozer-accent-muted)]/20 bg-[var(--ozer-accent-subtle)] px-3 py-1 text-xs text-[var(--ozer-accent-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {mode === 'day' ? 'Planning your day…' : 'Planning your week…'}
          </span>
        ) : null}
      </div>

      <div className="min-h-[min(58vh,560px)] rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
        {markdown.trim() ? (
          <PlanOutputRenderer markdown={markdown} />
        ) : isGenerating ? (
          <div className="flex min-h-[min(52vh,500px)] flex-col items-center justify-center text-center text-[var(--workspace-shell-text)]/55">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[var(--ozer-accent-muted)]" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              {mode === 'day' ? 'Planning your day…' : 'Planning your week…'}
            </p>
            <p className="mt-1 max-w-sm text-sm">
              Balancing tasks, calendar blocks, buffers, and energy windows.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[min(52vh,500px)] flex-col items-center justify-center text-center text-[var(--workspace-shell-text)]/50">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]/70">
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
          {dayViewHref && mode === 'day' ? (
            <Button
              asChild
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
            >
              <Link href={dayViewHref}>Open today view</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
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
