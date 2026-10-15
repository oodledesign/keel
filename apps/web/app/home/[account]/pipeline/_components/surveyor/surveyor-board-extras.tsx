'use client';

import { type Dispatch, type SetStateAction, useCallback } from 'react';

import { Kanban, MoreHorizontal, Plus, Table2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { moveDealToStage, updateDeal } from '~/home/(user)/pipeline/actions';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  EMPTY_SURVEYOR_LEAD,
  type SurveyorPipelineSettings,
  type SurveyorTickInput,
  applySurveyorTickInput,
} from '~/lib/building-surveyor/surveyor-lead';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { markSurveyorLeadsLostAction } from '../../_lib/server/surveyor-lead-actions';
import { LeadTrafficLight } from './lead-traffic-light';
import type { SurveyorSheetPatch } from './surveyor-lead-sheet';
import {
  type SurveyorMember,
  SurveyorStageTicks,
} from './surveyor-stage-ticks';

export type SurveyorBoardContext = {
  settings: SurveyorPipelineSettings;
  members: SurveyorMember[];
  currentUserId: string | null;
};

export type SurveyorBoardView = 'board' | 'sheet';

/** Optimistic lead updates shared by the surveyor board cards and sheet. */
export function useSurveyorLeadActions({
  setDeals,
  accountId,
  accountSlug,
  currentUserId,
}: {
  setDeals: Dispatch<SetStateAction<PipelineDeal[]>>;
  accountId?: string;
  accountSlug?: string;
  currentUserId: string | null;
}) {
  const replace = useCallback(
    (id: string, update: (deal: PipelineDeal) => PipelineDeal) =>
      setDeals((prev) =>
        prev.map((deal) => (deal.id === id ? update(deal) : deal)),
      ),
    [setDeals],
  );

  const moveStage = useCallback(
    (deal: PipelineDeal, stage: string) => {
      if (deal.stage === stage) return;
      replace(deal.id, (row) => ({ ...row, stage }));
      void moveDealToStage(deal.id, stage, { accountSlug }).then((result) => {
        if (!result.success) {
          replace(deal.id, (row) => ({ ...row, stage: deal.stage }));
          toast.error(result.error ?? 'Could not move the lead');
        }
      });
    },
    [replace, accountSlug],
  );

  const changeTicks = useCallback(
    (deal: PipelineDeal, input: SurveyorTickInput) => {
      const withChecker: SurveyorTickInput =
        input.reportChecked === true && input.reportCheckedBy === undefined
          ? { ...input, reportCheckedBy: currentUserId }
          : input;
      const previous = deal.surveyorLead ?? EMPTY_SURVEYOR_LEAD;
      replace(deal.id, (row) => ({
        ...row,
        surveyorLead: applySurveyorTickInput(
          row.surveyorLead ?? EMPTY_SURVEYOR_LEAD,
          withChecker,
        ),
      }));
      void updateDeal(deal.id, {
        ticks: withChecker,
        accountSlug: accountSlug ?? null,
      }).then((result) => {
        if (!result.success) {
          replace(deal.id, (row) => ({ ...row, surveyorLead: previous }));
          toast.error(result.error ?? 'Could not save the tick');
        }
      });
    },
    [replace, accountSlug, currentUserId],
  );

  const patchLead = useCallback(
    (deal: PipelineDeal, patch: SurveyorSheetPatch) => {
      const previous = deal;
      replace(deal.id, (row) => ({
        ...row,
        ...(patch.value !== undefined ? { value: patch.value } : {}),
        surveyorLead: {
          ...(row.surveyorLead ?? EMPTY_SURVEYOR_LEAD),
          ...(patch.surveyType !== undefined
            ? { surveyType: patch.surveyType }
            : {}),
          ...(patch.inspectionAt !== undefined
            ? { inspectionAt: patch.inspectionAt }
            : {}),
        },
      }));
      void updateDeal(deal.id, {
        ...(patch.value !== undefined ? { value: patch.value } : {}),
        // Sending `lead` (even empty) runs the surveyor sync for the fee.
        lead: {
          ...(patch.surveyType !== undefined
            ? { surveyType: patch.surveyType }
            : {}),
          ...(patch.inspectionAt !== undefined
            ? { inspectionAt: patch.inspectionAt }
            : {}),
        },
        accountSlug: accountSlug ?? null,
      }).then((result) => {
        if (!result.success) {
          replace(deal.id, () => previous);
          toast.error(result.error ?? 'Could not save the lead');
        }
      });
    },
    [replace, accountSlug],
  );

  const applyLost = useCallback(
    (dealIds: string[], lostAt: string) => {
      const ids = new Set(dealIds);
      setDeals((prev) =>
        prev.map((deal) =>
          ids.has(deal.id)
            ? {
                ...deal,
                stage: 'lost',
                surveyorLead: {
                  ...(deal.surveyorLead ?? EMPTY_SURVEYOR_LEAD),
                  lostAt,
                },
              }
            : deal,
        ),
      );
    },
    [setDeals],
  );

  const markLost = useCallback(
    (deal: PipelineDeal) => {
      if (!accountId || !accountSlug) return;
      void markSurveyorLeadsLostAction({
        accountId,
        accountSlug,
        dealIds: [deal.id],
      })
        .then((result) => {
          applyLost(result.updatedIds, result.lostAt);
          toast.success('Marked as lost');
        })
        .catch((error: unknown) => toast.error(getErrorMessage(error)));
    },
    [accountId, accountSlug, applyLost],
  );

  return { moveStage, changeTicks, patchLead, markLost, applyLost };
}

export function SurveyorBoardToolbar({
  view,
  onViewChange,
  showLost,
  onShowLostChange,
  onNewLead,
}: {
  view: SurveyorBoardView;
  onViewChange: (view: SurveyorBoardView) => void;
  showLost: boolean;
  onShowLostChange: (next: boolean) => void;
  onNewLead: () => void;
}) {
  const tab = (
    value: SurveyorBoardView,
    label: string,
    Icon: typeof Kanban,
  ) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => onViewChange(value)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
        view === value
          ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Pipeline view"
        className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs"
      >
        {tab('board', 'Board', Kanban)}
        {tab('sheet', 'Sheet', Table2)}
      </div>
      {view === 'board' ? (
        <div className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
          <Switch
            id="surveyor-board-show-lost"
            checked={showLost}
            onCheckedChange={onShowLostChange}
          />
          <label htmlFor="surveyor-board-show-lost">Show lost</label>
        </div>
      ) : null}
      <button
        type="button"
        className={workspaceBtnPrimaryMd}
        onClick={onNewLead}
      >
        <Plus className="h-4 w-4" />
        New lead
      </button>
    </>
  );
}

/** Ticks and the traffic light at the foot of a surveyor card. */
export function SurveyorCardExtras({
  deal,
  context,
  onTicks,
}: {
  deal: PipelineDeal;
  context: SurveyorBoardContext;
  onTicks?: (deal: PipelineDeal, input: SurveyorTickInput) => void;
}) {
  const lead = deal.surveyorLead ?? EMPTY_SURVEYOR_LEAD;
  return (
    <div
      className="mt-2 flex items-center justify-between gap-2 border-t border-[color:var(--workspace-shell-border)] pt-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <SurveyorStageTicks
        stage={deal.stage}
        ticks={lead}
        members={context.members}
        disabled={!onTicks}
        onChange={(input) => onTicks?.(deal, input)}
      />
      <LeadTrafficLight
        lastActivityAt={lead.lastActivityAt}
        settings={context.settings}
        className="ml-auto"
      />
    </div>
  );
}

export function SurveyorCardMenu({
  deal,
  onOpen,
  onMarkLost,
}: {
  deal: PipelineDeal;
  onOpen: () => void;
  onMarkLost?: (deal: PipelineDeal) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          aria-label="Lead actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>Open lead</DropdownMenuItem>
        {deal.stage !== 'lost' && onMarkLost ? (
          <DropdownMenuItem onSelect={() => onMarkLost(deal)}>
            Mark as lost
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
