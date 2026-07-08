'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import Link from 'next/link';

import { Loader2, RefreshCcw } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { PlanDocument } from '~/lib/planner/plan-blocks';
import { flattenPlanBlocks } from '~/lib/planner/plan-blocks';
import { toLocalDateYmd } from '~/lib/planner/plan-storage';

import { DayScheduleEditor } from './DayScheduleEditor';
import { PlannerSyncCalendarButton } from './planner-push-to-calendar-button';
import type { PlanningMode } from './planner-types';

const PlanOutputRenderer = dynamic(
  () => import('./PlanOutputRenderer').then((mod) => mod.PlanOutputRenderer),
  { ssr: false },
);

type Props = {
  mode: PlanningMode;
  date: string;
  markdown: string;
  isGenerating: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
  dayViewHref?: string;
  planDocument: PlanDocument | null;
  onPlanDocumentChange: (document: PlanDocument) => void;
  onPersistPlanDocument: (document: PlanDocument) => Promise<void>;
  onSyncBlock?: (
    document: PlanDocument,
    blockId: string,
  ) => Promise<PlanDocument | null>;
};

export function PlanOutputPanel({
  mode,
  date,
  markdown,
  isGenerating,
  onRegenerate,
  canRegenerate,
  dayViewHref,
  planDocument,
  onPlanDocumentChange,
  onPersistPlanDocument,
  onSyncBlock,
}: Props) {
  const [now] = useState(() => new Date());
  const complete = markdown.trim().length > 0 && !isGenerating;
  const editableBlockCount = planDocument
    ? flattenPlanBlocks(planDocument).length
    : 0;
  const showDayScheduleEditor =
    complete && mode === 'day' && planDocument !== null && editableBlockCount > 0;

  return (
    <section className="sticky top-4 min-h-[min(80vh,720px)] rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.22)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Generated plan</h2>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            {showDayScheduleEditor
              ? 'Drag blocks to reschedule — including calendar events.'
              : 'Preview updates as Claude streams your schedule.'}
          </p>
        </div>
        {isGenerating ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-3 py-1 text-xs text-[var(--workspace-shell-accent-text)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {mode === 'day' ? 'Planning your day…' : 'Planning your week…'}
          </span>
        ) : null}
      </div>

      <div className="min-h-[min(58vh,560px)] rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
        {showDayScheduleEditor && planDocument ? (
          <DayScheduleEditor
            document={planDocument}
            onDocumentChange={onPlanDocumentChange}
            onPersist={onPersistPlanDocument}
            now={now}
            scheduleDateYmd={toLocalDateYmd(new Date(date))}
            calendarEventsMovable
            onSyncBlock={onSyncBlock}
          />
        ) : markdown.trim() ? (
          <PlanOutputRenderer markdown={markdown} />
        ) : isGenerating ? (
          <div className="flex min-h-[min(52vh,500px)] flex-col items-center justify-center text-center text-[var(--workspace-shell-text)]/55">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[var(--workspace-shell-accent-text)]" />
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
          <PlannerSyncCalendarButton
            dateIso={`${toLocalDateYmd(new Date(date))}T12:00:00`}
            mode={mode}
            planDocument={planDocument}
            onSynced={onPersistPlanDocument}
          />
        </div>
      ) : null}
    </section>
  );
}
